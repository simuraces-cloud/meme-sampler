import { create } from 'zustand'
import * as Tone from 'tone'
import {
  DRUM_TRACKS,
  STEPS,
  ensureAudioStarted,
  setBpm,
  setMasterVolumeDb,
  startTransport,
  stopTransport,
  triggerDrum,
  setStepCallback,
  getPadBus,
  type DrumTrack,
} from './audio/engine'
import { PRESETS, PRESETS_BY_ID, type Trigger } from './audio/presets'

export const PAD_HOTKEYS = [
  '1', '2', '3', '4',
  'q', 'w', 'e', 'r',
  'a', 's', 'd', 'f',
  'z', 'x', 'c', 'v',
]

export type PadSource =
  | { kind: 'preset'; presetId: string }
  | { kind: 'sample'; url: string; name: string }
  | { kind: 'empty' }

export type Pad = {
  id: number
  hotkey: string
  source: PadSource
  label: string
  color: string
  emoji: string
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
}

type Actions = {
  togglePlay: () => Promise<void>
  setBpm: (bpm: number) => void
  setMasterVol: (db: number) => void
  toggleStep: (track: DrumTrack, step: number) => void
  clearDrums: () => void
  triggerPad: (padIndex: number) => Promise<void>
  loadSampleToPad: (padIndex: number, file: File) => Promise<void>
  resetPadToPreset: (padIndex: number, presetId: string) => void
}

export type Store = State & Actions

const presetTriggerCache = new Map<string, Trigger>()
const samplePlayers = new Map<number, Tone.Player>()

function getPresetTrigger(presetId: string): Trigger {
  let t = presetTriggerCache.get(presetId)
  if (!t) {
    const preset = PRESETS_BY_ID[presetId]
    if (!preset) return () => {}
    t = preset.build()
    presetTriggerCache.set(presetId, t)
  }
  return t
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

function emptyPattern(): DrumPattern {
  const p: Partial<DrumPattern> = {}
  for (const t of DRUM_TRACKS) p[t] = Array(STEPS).fill(false)
  return p as DrumPattern
}

function seedPattern(): DrumPattern {
  const p = emptyPattern()
  // basic 4-on-the-floor + back-beat + 8th hats
  for (let s = 0; s < STEPS; s += 4) p.kick[s] = true
  p.snare[4] = true
  p.snare[12] = true
  for (let s = 0; s < STEPS; s += 2) p.closedHat[s] = true
  p.openHat[6] = true
  p.openHat[14] = true
  return p
}

export const useStore = create<Store>((set, get) => ({
  pads: defaultPads(),
  drumPattern: seedPattern(),
  bpm: 110,
  isPlaying: false,
  masterVolDb: -4,
  currentStep: -1,
  triggeredAt: {},

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

  triggerPad: async (padIndex) => {
    await ensureAudioStarted()
    const pad = get().pads[padIndex]
    if (!pad) return
    if (pad.source.kind === 'preset') {
      getPresetTrigger(pad.source.presetId)()
    } else if (pad.source.kind === 'sample') {
      const player = samplePlayers.get(padIndex)
      if (player && player.loaded) {
        player.start()
      }
    }
    set((s) => ({ triggeredAt: { ...s.triggeredAt, [padIndex]: Date.now() } }))
  },

  loadSampleToPad: async (padIndex, file) => {
    await ensureAudioStarted()
    const url = URL.createObjectURL(file)
    const player = new Tone.Player({ url, autostart: false }).connect(getPadBus())
    await Tone.loaded()
    const old = samplePlayers.get(padIndex)
    if (old) {
      old.stop()
      old.dispose()
    }
    samplePlayers.set(padIndex, player)
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
  },

  resetPadToPreset: (padIndex, presetId) => {
    const preset = PRESETS_BY_ID[presetId]
    if (!preset) return
    const old = samplePlayers.get(padIndex)
    if (old) {
      old.stop()
      old.dispose()
      samplePlayers.delete(padIndex)
    }
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
  // Schedule UI update on the main thread
  Tone.getDraw().schedule(() => {
    useStore.setState({ currentStep: step })
  }, time)
})
