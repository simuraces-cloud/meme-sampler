import * as Tone from 'tone'

let started = false

export async function ensureAudioStarted() {
  if (started) return
  await Tone.start()
  started = true
}

export const masterLimiter = new Tone.Limiter(-1).toDestination()
export const masterVolume = new Tone.Volume(-4).connect(masterLimiter)

const reverb = new Tone.Reverb({ decay: 1.4, wet: 0.12 }).connect(masterVolume)
const drumBus = new Tone.Gain(1).connect(reverb)
const padBus = new Tone.Gain(1).connect(reverb)

export function getDrumBus() {
  return drumBus
}

export function getPadBus() {
  return padBus
}

export function setMasterVolumeDb(db: number) {
  masterVolume.volume.rampTo(db, 0.05)
}

// ---------- Drum machine ----------

const kick = new Tone.MembraneSynth({
  pitchDecay: 0.04,
  octaves: 6,
  envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 },
  volume: -2,
}).connect(drumBus)

const snareNoise = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  volume: -8,
}).connect(drumBus)

const snareBody = new Tone.MembraneSynth({
  pitchDecay: 0.02,
  octaves: 4,
  envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  volume: -10,
}).connect(drumBus)

const closedHatFilter = new Tone.Filter(8000, 'highpass').connect(drumBus)
const closedHat = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
  volume: -16,
}).connect(closedHatFilter)

const openHatFilter = new Tone.Filter(7000, 'highpass').connect(drumBus)
const openHat = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.4, sustain: 0 },
  volume: -16,
}).connect(openHatFilter)

export type DrumTrack = 'kick' | 'snare' | 'closedHat' | 'openHat'

export const DRUM_TRACKS: DrumTrack[] = ['kick', 'snare', 'closedHat', 'openHat']

export const DRUM_LABEL: Record<DrumTrack, string> = {
  kick: 'KICK',
  snare: 'SNARE',
  closedHat: 'HAT',
  openHat: 'OPEN',
}

export function triggerDrum(track: DrumTrack, time?: number, velocity = 1) {
  const t = time ?? Tone.now()
  switch (track) {
    case 'kick':
      kick.triggerAttackRelease('C1', '8n', t, velocity)
      return
    case 'snare':
      snareNoise.triggerAttackRelease('16n', t, velocity)
      snareBody.triggerAttackRelease('G2', '16n', t, velocity * 0.6)
      return
    case 'closedHat':
      closedHat.triggerAttackRelease('32n', t, velocity)
      return
    case 'openHat':
      openHat.triggerAttackRelease('8n', t, velocity * 0.85)
      return
  }
}

// ---------- Transport / loop ----------

export const STEPS = 16

let sequence: Tone.Sequence<number> | null = null
let stepCallback: ((step: number, time: number) => void) | null = null

export function setStepCallback(cb: (step: number, time: number) => void) {
  stepCallback = cb
}

export function ensureSequence() {
  if (sequence) return
  sequence = new Tone.Sequence(
    (time, step) => {
      stepCallback?.(step, time)
    },
    Array.from({ length: STEPS }, (_, i) => i),
    '16n',
  )
  sequence.start(0)
}

export function startTransport() {
  ensureSequence()
  Tone.getTransport().start()
}

export function stopTransport() {
  Tone.getTransport().stop()
}

export function setBpm(bpm: number) {
  Tone.getTransport().bpm.rampTo(bpm, 0.05)
}

Tone.getTransport().bpm.value = 110
Tone.getTransport().loop = true
Tone.getTransport().loopStart = 0
Tone.getTransport().loopEnd = '1m'
