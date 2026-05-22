import { create } from 'zustand'
import * as Tone from 'tone'
import { Midi } from '@tonejs/midi'
import {
  DRUM_TRACKS,
  STEPS,
  audioBufferToWav,
  decodeBlobToBuffer,
  ensureAudioStarted,
  getPadChannel,
  recordLoopToBlob,
  setBpm,
  setMasterVolumeDb,
  setPadBitcrush,
  setPadFilterFreq,
  setPadReverbSend,
  startTransport,
  stopTransport,
  triggerDrum,
  setStepCallback,
  type DrumTrack,
} from './audio/engine'
import { PRESETS, PRESETS_BY_ID, type PresetInstance } from './audio/presets'

export const PAD_HOTKEYS = [
  '1', '2', '3', '4',
  'q', 'w', 'e', 'r',
  'a', 's', 'd', 'f',
  'z', 'x', 'c', 'v',
]

export type PadSource =
  | { kind: 'preset'; presetId: string }
  | { kind: 'sample'; url: string; name: string }
  | { kind: 'chop'; trackName: string; startSec: number; endSec: number }
  | { kind: 'empty' }

export type Pad = {
  id: number
  hotkey: string
  source: PadSource
  label: string
  color: string
  emoji: string
}

export type PadFx = {
  pitch: number // semitones, -24..+24
  filterFreq: number // 80..20000 Hz
  bitcrushOn: boolean
  bitcrushBits: number // 1..8
  reverbSend: number // 0..1
  gain: number // 0..1.5
}

export type MidiNoteEvent = {
  time: number // sec from start
  duration: number // sec
  pitch: number // MIDI pitch 0..127
  velocity: number // 0..1
}

export type MidiData = {
  name: string
  notes: MidiNoteEvent[]
  durationSec: number
}

export type AudioTrackData = {
  name: string
  durationSec: number
  peaks: number[] // pre-computed peaks for waveform display
}

type DrumPattern = Record<DrumTrack, boolean[]>

type State = {
  pads: Pad[]
  drumPattern: DrumPattern
  bpm: number
  isPlaying: boolean
  masterVolDb: number
  currentStep: number
  triggeredAt: Record<number, number>
  padFx: Record<number, PadFx>

  midi: MidiData | null
  midiTargetPad: number // pad index for melody mode
  midiMode: 'melody' | 'drums'
  isPlayingMidi: boolean

  audioTrack: AudioTrackData | null

  isRecording: boolean
  recordedEventCount: number

  isExporting: boolean
}

type Actions = {
  togglePlay: () => Promise<void>
  setBpm: (bpm: number) => void
  setMasterVol: (db: number) => void
  toggleStep: (track: DrumTrack, step: number) => void
  clearDrums: () => void
  triggerPad: (padIndex: number, velocity?: number, semitonesOverride?: number, time?: number) => Promise<void>
  loadSampleToPad: (padIndex: number, file: File) => Promise<void>
  resetPadToPreset: (padIndex: number, presetId: string) => Promise<void>

  setPadFx: (padIndex: number, patch: Partial<PadFx>) => void
  resetPadFx: (padIndex: number) => void

  loadMidi: (file: File) => Promise<void>
  setMidiTargetPad: (padIndex: number) => void
  setMidiMode: (mode: 'melody' | 'drums') => void
  playMidi: () => Promise<void>
  stopMidi: () => void

  loadAudioTrack: (file: File) => Promise<void>
  assignChopToPad: (padIndex: number, startSec: number, endSec: number) => Promise<void>

  toggleRecord: () => Promise<void>
  clearRecording: () => void

  generateAiDrums: (style?: AiStyle) => void

  exportLoop: (bars?: number) => Promise<void>
}

export type Store = State & Actions

// ---- Engine-side caches (NOT React state) ----

const padInstances = new Map<number, PresetInstance>() // per-pad preset, fresh per pad
const samplePlayers = new Map<number, Tone.Player>()
const samplePitchers = new Map<number, Tone.PitchShift>()
let audioTrackBuffer: AudioBuffer | null = null
let audioTrackPlayer: Tone.Player | null = null
let audioTrackPitcher: Tone.PitchShift | null = null
let midiPart: Tone.Part<MidiNoteEvent> | null = null
let recordingPart: Tone.Part<{ time: number; padIndex: number; vel: number; semis: number }> | null = null
let recordingBuffer: { time: number; padIndex: number; vel: number; semis: number }[] = []
let recordStartTicks = 0

function disposePadInstance(padIndex: number) {
  const inst = padInstances.get(padIndex)
  if (inst) {
    inst.dispose()
    padInstances.delete(padIndex)
  }
  const oldPlayer = samplePlayers.get(padIndex)
  if (oldPlayer) {
    oldPlayer.stop()
    oldPlayer.dispose()
    samplePlayers.delete(padIndex)
  }
  const oldPitch = samplePitchers.get(padIndex)
  if (oldPitch) {
    oldPitch.dispose()
    samplePitchers.delete(padIndex)
  }
}

function ensurePresetInstance(padIndex: number, presetId: string): PresetInstance {
  let inst = padInstances.get(padIndex)
  if (inst) return inst
  const preset = PRESETS_BY_ID[presetId]
  if (!preset) throw new Error(`Unknown preset: ${presetId}`)
  const ch = getPadChannel(padIndex)
  inst = preset.build(ch.input)
  padInstances.set(padIndex, inst)
  return inst
}

function defaultPads(): Pad[] {
  return PAD_HOTKEYS.map((hotkey, i) => {
    const preset = PRESETS[i]
    return {
      id: i,
      hotkey,
      source: { kind: 'preset', presetId: preset.id },
      label: preset.label,
      color: preset.color,
      emoji: preset.emoji,
    }
  })
}

function defaultFx(): PadFx {
  return {
    pitch: 0,
    filterFreq: 20000,
    bitcrushOn: false,
    bitcrushBits: 4,
    reverbSend: 0.12,
    gain: 1,
  }
}

function defaultPadFx(): Record<number, PadFx> {
  const out: Record<number, PadFx> = {}
  for (let i = 0; i < 16; i++) out[i] = defaultFx()
  return out
}

function emptyPattern(): DrumPattern {
  const p: Partial<DrumPattern> = {}
  for (const t of DRUM_TRACKS) p[t] = Array(STEPS).fill(false)
  return p as DrumPattern
}

function seedPattern(): DrumPattern {
  const p = emptyPattern()
  for (let s = 0; s < STEPS; s += 4) p.kick[s] = true
  p.snare[4] = true
  p.snare[12] = true
  for (let s = 0; s < STEPS; s += 2) p.closedHat[s] = true
  p.openHat[6] = true
  p.openHat[14] = true
  return p
}

// Compute downsampled peaks for waveform display
function computePeaks(buffer: AudioBuffer, target = 400): number[] {
  const data = buffer.getChannelData(0)
  const blockSize = Math.max(1, Math.floor(data.length / target))
  const peaks: number[] = []
  for (let i = 0; i < target; i++) {
    let max = 0
    const start = i * blockSize
    const end = Math.min(start + blockSize, data.length)
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j])
      if (v > max) max = v
    }
    peaks.push(max)
  }
  return peaks
}

// ---- AI drum generator (rule-based templates with randomization) ----

export type AiStyle = 'fourOnFloor' | 'trap' | 'boomBap' | 'breakbeat' | 'dnb' | 'half'

const AI_TEMPLATES: Record<AiStyle, DrumPattern> = {
  fourOnFloor: {
    kick:      [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean),
    snare:     [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    closedHat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
    openHat:   [0,0,0,1, 0,0,0,1, 0,0,0,1, 0,0,0,1].map(Boolean),
  },
  trap: {
    kick:      [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,1].map(Boolean),
    snare:     [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    closedHat: [1,1,1,1, 1,1,0,1, 1,1,1,0, 1,1,1,1].map(Boolean),
    openHat:   [0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0].map(Boolean),
  },
  boomBap: {
    kick:      [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
    snare:     [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1].map(Boolean),
    closedHat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
    openHat:   [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0].map(Boolean),
  },
  breakbeat: {
    kick:      [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0].map(Boolean),
    snare:     [0,0,0,0, 1,0,0,0, 0,1,0,0, 1,0,0,1].map(Boolean),
    closedHat: [1,1,0,1, 1,1,1,0, 1,1,0,1, 0,1,1,1].map(Boolean),
    openHat:   [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
  },
  dnb: {
    kick:      [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
    snare:     [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    closedHat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1].map(Boolean),
    openHat:   [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1].map(Boolean),
  },
  half: {
    kick:      [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0].map(Boolean),
    snare:     [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0].map(Boolean),
    closedHat: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean),
    openHat:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0].map(Boolean),
  },
}

function pickStyle(): AiStyle {
  const styles: AiStyle[] = ['fourOnFloor', 'trap', 'boomBap', 'breakbeat', 'dnb', 'half']
  return styles[Math.floor(Math.random() * styles.length)]
}

function mutatePattern(base: DrumPattern): DrumPattern {
  // Random embellishments
  const out: DrumPattern = {
    kick: base.kick.slice(),
    snare: base.snare.slice(),
    closedHat: base.closedHat.slice(),
    openHat: base.openHat.slice(),
  }
  // ~15% random kicks, ~10% random snares (ghost notes), some hat dropouts
  for (let i = 0; i < STEPS; i++) {
    if (!out.kick[i] && Math.random() < 0.08) out.kick[i] = true
    if (!out.snare[i] && Math.random() < 0.06) out.snare[i] = true
    if (out.closedHat[i] && Math.random() < 0.12) out.closedHat[i] = false
  }
  // Ensure backbeat on 4 and 12
  out.snare[4] = true
  out.snare[12] = true
  return out
}

// ---- Note → pad mapping for MIDI ----

function midiNoteToPadIndex(pitch: number): number {
  // Use 16-tone wrap so any MIDI keyboard playing gets distributed across pads
  return ((pitch % 16) + 16) % 16
}

// ---- Volume / FX application ----

function applyPadFx(padIndex: number, fx: PadFx) {
  setPadFilterFreq(padIndex, fx.filterFreq)
  setPadBitcrush(padIndex, fx.bitcrushOn, fx.bitcrushBits)
  setPadReverbSend(padIndex, fx.reverbSend)
  const ch = getPadChannel(padIndex)
  ch.outDry.gain.rampTo(fx.gain, 0.03)
  // Apply pitch shift to sample (if any). Presets get pitch via trigger semitones param.
  const pitcher = samplePitchers.get(padIndex)
  if (pitcher) pitcher.pitch = fx.pitch
}

// ---- Store ----

export const useStore = create<Store>((set, get) => ({
  pads: defaultPads(),
  drumPattern: seedPattern(),
  bpm: 110,
  isPlaying: false,
  masterVolDb: -4,
  currentStep: -1,
  triggeredAt: {},
  padFx: defaultPadFx(),

  midi: null,
  midiTargetPad: 0,
  midiMode: 'melody',
  isPlayingMidi: false,

  audioTrack: null,

  isRecording: false,
  recordedEventCount: 0,

  isExporting: false,

  togglePlay: async () => {
    await ensureAudioStarted()
    if (get().isPlaying) {
      stopTransport()
      set({ isPlaying: false, currentStep: -1 })
    } else {
      startTransport()
      set({ isPlaying: true })
    }
  },

  setBpm: (bpm) => {
    const clamped = Math.max(40, Math.min(220, Math.round(bpm)))
    setBpm(clamped)
    set({ bpm: clamped })
  },

  setMasterVol: (db) => {
    setMasterVolumeDb(db)
    set({ masterVolDb: db })
  },

  toggleStep: (track, step) => {
    const pattern = get().drumPattern
    const next = { ...pattern, [track]: pattern[track].slice() }
    next[track][step] = !next[track][step]
    set({ drumPattern: next })
  },

  clearDrums: () => set({ drumPattern: emptyPattern() }),

  triggerPad: async (padIndex, velocity = 1, semitonesOverride, time) => {
    await ensureAudioStarted()
    const pad = get().pads[padIndex]
    if (!pad) return
    const fx = get().padFx[padIndex] ?? defaultFx()
    const semis = semitonesOverride ?? fx.pitch
    if (pad.source.kind === 'preset') {
      const inst = ensurePresetInstance(padIndex, pad.source.presetId)
      inst.trigger(time, velocity, semis)
    } else if (pad.source.kind === 'sample') {
      const player = samplePlayers.get(padIndex)
      const pitcher = samplePitchers.get(padIndex)
      if (player && player.loaded) {
        if (pitcher) pitcher.pitch = semis
        player.start(time)
      }
    } else if (pad.source.kind === 'chop') {
      if (!audioTrackBuffer || !audioTrackPlayer) return
      const pitcher = audioTrackPitcher
      if (pitcher) pitcher.pitch = semis
      // Connect track player to this pad's channel before playing
      try {
        audioTrackPitcher?.disconnect()
      } catch {
        /* ignore */
      }
      audioTrackPitcher?.connect(getPadChannel(padIndex).input)
      const dur = Math.max(0.02, pad.source.endSec - pad.source.startSec)
      audioTrackPlayer.start(time, pad.source.startSec, dur)
    }
    // Recording capture
    if (get().isRecording) {
      const ticksNow = Tone.getTransport().ticks
      const offset = ticksNow - recordStartTicks
      const beatsPerBar = 4
      const ticksPerBar = Tone.getTransport().PPQ * beatsPerBar
      const offsetSec = (offset / ticksPerBar) * (60 / Tone.getTransport().bpm.value) * beatsPerBar
      recordingBuffer.push({ time: offsetSec, padIndex, vel: velocity, semis })
      set({ recordedEventCount: recordingBuffer.length })
    }
    set((s) => ({ triggeredAt: { ...s.triggeredAt, [padIndex]: Date.now() } }))
  },

  loadSampleToPad: async (padIndex, file) => {
    await ensureAudioStarted()
    const url = URL.createObjectURL(file)
    disposePadInstance(padIndex)
    const ch = getPadChannel(padIndex)
    const pitcher = new Tone.PitchShift({ pitch: get().padFx[padIndex]?.pitch ?? 0 })
    pitcher.connect(ch.input)
    const player = new Tone.Player({ url, autostart: false }).connect(pitcher)
    await Tone.loaded()
    samplePlayers.set(padIndex, player)
    samplePitchers.set(padIndex, pitcher)
    set((s) => {
      const pads = s.pads.slice()
      const baseLabel = file.name.replace(/\.[^.]+$/, '').toUpperCase().slice(0, 10)
      pads[padIndex] = {
        ...pads[padIndex],
        source: { kind: 'sample', url, name: file.name },
        label: baseLabel || 'SAMPLE',
        emoji: '🎵',
      }
      return { pads }
    })
    applyPadFx(padIndex, get().padFx[padIndex] ?? defaultFx())
  },

  resetPadToPreset: async (padIndex, presetId) => {
    await ensureAudioStarted()
    const preset = PRESETS_BY_ID[presetId]
    if (!preset) return
    disposePadInstance(padIndex)
    // Pre-build the new instance so it's ready on first trigger
    ensurePresetInstance(padIndex, presetId)
    set((s) => {
      const pads = s.pads.slice()
      pads[padIndex] = {
        ...pads[padIndex],
        source: { kind: 'preset', presetId },
        label: preset.label,
        color: preset.color,
        emoji: preset.emoji,
      }
      return { pads }
    })
    applyPadFx(padIndex, get().padFx[padIndex] ?? defaultFx())
  },

  setPadFx: (padIndex, patch) => {
    const current = get().padFx[padIndex] ?? defaultFx()
    const next: PadFx = { ...current, ...patch }
    set((s) => ({ padFx: { ...s.padFx, [padIndex]: next } }))
    applyPadFx(padIndex, next)
  },

  resetPadFx: (padIndex) => {
    const def = defaultFx()
    set((s) => ({ padFx: { ...s.padFx, [padIndex]: def } }))
    applyPadFx(padIndex, def)
  },

  loadMidi: async (file) => {
    const buf = await file.arrayBuffer()
    const midi = new Midi(buf)
    const notes: MidiNoteEvent[] = []
    for (const track of midi.tracks) {
      for (const n of track.notes) {
        notes.push({
          time: n.time,
          duration: n.duration,
          pitch: n.midi,
          velocity: n.velocity,
        })
      }
    }
    notes.sort((a, b) => a.time - b.time)
    const durationSec = midi.duration
    set({ midi: { name: file.name, notes, durationSec } })
  },

  setMidiTargetPad: (padIndex) => set({ midiTargetPad: padIndex }),
  setMidiMode: (mode) => set({ midiMode: mode }),

  playMidi: async () => {
    await ensureAudioStarted()
    const data = get().midi
    if (!data) return
    if (midiPart) {
      midiPart.stop()
      midiPart.dispose()
      midiPart = null
    }
    const mode = get().midiMode
    const target = get().midiTargetPad
    midiPart = new Tone.Part<MidiNoteEvent>((time, event) => {
      const padIndex = mode === 'melody' ? target : midiNoteToPadIndex(event.pitch)
      // semitones relative to C4 (MIDI 60) for natural pitch mapping in melody mode
      const semis = mode === 'melody' ? event.pitch - 60 : 0
      void get().triggerPad(padIndex, event.velocity, semis, time)
    }, data.notes)
    midiPart.start(0)
    // Ensure transport is running
    if (!get().isPlaying) {
      startTransport()
      set({ isPlaying: true })
    }
    set({ isPlayingMidi: true })
  },

  stopMidi: () => {
    if (midiPart) {
      midiPart.stop()
      midiPart.dispose()
      midiPart = null
    }
    set({ isPlayingMidi: false })
  },

  loadAudioTrack: async (file) => {
    await ensureAudioStarted()
    const arr = await file.arrayBuffer()
    const blob = new Blob([arr])
    const buffer = await decodeBlobToBuffer(blob)
    audioTrackBuffer = buffer
    if (audioTrackPlayer) {
      audioTrackPlayer.stop()
      audioTrackPlayer.dispose()
    }
    if (audioTrackPitcher) {
      audioTrackPitcher.dispose()
    }
    audioTrackPitcher = new Tone.PitchShift({ pitch: 0 })
    audioTrackPlayer = new Tone.Player(buffer)
    audioTrackPlayer.connect(audioTrackPitcher)
    const peaks = computePeaks(buffer, 400)
    set({
      audioTrack: {
        name: file.name,
        durationSec: buffer.duration,
        peaks,
      },
    })
  },

  assignChopToPad: async (padIndex, startSec, endSec) => {
    await ensureAudioStarted()
    const track = get().audioTrack
    if (!track || !audioTrackBuffer) return
    disposePadInstance(padIndex)
    set((s) => {
      const pads = s.pads.slice()
      pads[padIndex] = {
        ...pads[padIndex],
        source: { kind: 'chop', trackName: track.name, startSec, endSec },
        label: `CHOP ${(startSec).toFixed(1)}s`,
        emoji: '✂️',
      }
      return { pads }
    })
    applyPadFx(padIndex, get().padFx[padIndex] ?? defaultFx())
  },

  toggleRecord: async () => {
    await ensureAudioStarted()
    const wasRecording = get().isRecording
    if (wasRecording) {
      // Stop and arm playback of recording
      if (recordingPart) {
        recordingPart.stop()
        recordingPart.dispose()
        recordingPart = null
      }
      if (recordingBuffer.length > 0) {
        const bpm = get().bpm
        const loopSec = (60 / bpm) * 4 // 1 bar at 4/4
        const looped = recordingBuffer.map((e) => ({ ...e, time: e.time % loopSec }))
        const part = new Tone.Part<{ time: number; padIndex: number; vel: number; semis: number }>(
          (time, ev) => {
            void get().triggerPad(ev.padIndex, ev.vel, ev.semis, time)
          },
          looped,
        )
        part.loop = true
        part.loopEnd = loopSec
        part.start(0)
        recordingPart = part
      }
      set({ isRecording: false })
    } else {
      // Start fresh recording — clear previous part + buffer
      if (recordingPart) {
        recordingPart.stop()
        recordingPart.dispose()
        recordingPart = null
      }
      recordingBuffer = []
      recordStartTicks = Tone.getTransport().ticks
      if (!get().isPlaying) {
        startTransport()
        set({ isPlaying: true })
      }
      set({ isRecording: true, recordedEventCount: 0 })
    }
  },

  clearRecording: () => {
    if (recordingPart) {
      recordingPart.stop()
      recordingPart.dispose()
      recordingPart = null
    }
    recordingBuffer = []
    set({ recordedEventCount: 0, isRecording: false })
  },

  generateAiDrums: (style) => {
    const s = style ?? pickStyle()
    const base = AI_TEMPLATES[s]
    set({ drumPattern: mutatePattern(base) })
  },

  exportLoop: async (bars = 1) => {
    await ensureAudioStarted()
    set({ isExporting: true })
    try {
      const blob = await recordLoopToBlob(bars)
      const buffer = await decodeBlobToBuffer(blob)
      const wavBlob = audioBufferToWav(buffer)
      const url = URL.createObjectURL(wavBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meme-sampler-loop-${Date.now()}.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally {
      set({ isExporting: false })
    }
  },
}))

// Wire the step callback to the store so playback triggers drums
setStepCallback((step, time) => {
  const pattern = useStore.getState().drumPattern
  for (const track of DRUM_TRACKS) {
    if (pattern[track][step]) {
      triggerDrum(track, time)
    }
  }
  Tone.getDraw().schedule(() => {
    useStore.setState({ currentStep: step })
  }, time)
})
