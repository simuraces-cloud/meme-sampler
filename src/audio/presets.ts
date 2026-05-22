import * as Tone from 'tone'
import { getPadBus } from './engine'

export type Trigger = (time?: number, velocity?: number, semitones?: number) => void

export type Preset = {
  id: string
  label: string
  color: string
  emoji: string
  build: () => Trigger
}

function shiftFreq(freqHz: number, semis: number) {
  return freqHz * Math.pow(2, semis / 12)
}

function shiftNote(note: string, semis: number) {
  return Tone.Frequency(note).transpose(semis).toFrequency()
}

// --- BOOM (Vine-style sub bass thump) ---
function buildBoom(): Trigger {
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.5,
    octaves: 10,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 },
    volume: 0,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    synth.triggerAttackRelease(shiftNote('C1', semis), '2n', time ?? Tone.now(), vel)
  }
}

// --- AIR HORN (detuned saw chord) ---
function buildAirhorn(): Trigger {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.15 },
    volume: -12,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    const notes = ['A2', 'C3', 'E3', 'A3'].map((n) =>
      Tone.Frequency(n).transpose(semis).toNote(),
    )
    synth.triggerAttackRelease(notes, 0.5, t, vel)
  }
}

// --- TADA (major arpeggio fanfare) ---
function buildTada(): Trigger {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.4 },
    volume: -8,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    const notes = ['C4', 'E4', 'G4', 'C5'].map((n) =>
      Tone.Frequency(n).transpose(semis).toNote(),
    )
    notes.forEach((n, i) => {
      synth.triggerAttackRelease(n, '8n', t + i * 0.08, vel)
    })
    synth.triggerAttackRelease(notes, '2n', t + 0.32, vel)
  }
}

// --- OOF (Roblox-style pitched thump) ---
function buildOof(): Trigger {
  const noise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0 },
    volume: -16,
  }).connect(getPadBus())
  const tone = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 },
    volume: -10,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    noise.triggerAttackRelease('16n', t, vel)
    tone.frequency.setValueAtTime(shiftFreq(280, semis), t)
    tone.frequency.exponentialRampToValueAtTime(shiftFreq(120, semis), t + 0.15)
    tone.triggerAttackRelease(shiftFreq(280, semis), 0.18, t, vel)
  }
}

// --- BRUH (square voice-like) ---
function buildBruh(): Trigger {
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.15 },
    volume: -14,
  }).connect(getPadBus())
  const lfo = new Tone.LFO(6, -12, 12).start()
  lfo.connect(synth.detune)
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    synth.triggerAttackRelease(shiftFreq(110, semis), 0.32, t, vel)
  }
}

// --- WOW (sine pitch bend up then down) ---
function buildWow(): Trigger {
  const synth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.2 },
    volume: -8,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    const base = shiftFreq(330, semis)
    synth.frequency.cancelScheduledValues(t)
    synth.frequency.setValueAtTime(base * 0.85, t)
    synth.frequency.exponentialRampToValueAtTime(base * 1.2, t + 0.18)
    synth.frequency.exponentialRampToValueAtTime(base, t + 0.45)
    synth.triggerAttackRelease(base, 0.5, t, vel)
  }
}

// --- YEAH (filtered noise burst with formant-ish tone) ---
function buildYeah(): Trigger {
  const noise = new Tone.Noise('pink').start()
  const filt = new Tone.Filter(1200, 'bandpass', -24)
  filt.Q.value = 8
  const gain = new Tone.Gain(0).connect(getPadBus())
  noise.connect(filt)
  filt.connect(gain)
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(vel * 0.4, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    filt.frequency.cancelScheduledValues(t)
    filt.frequency.setValueAtTime(shiftFreq(700, semis), t)
    filt.frequency.exponentialRampToValueAtTime(shiftFreq(1600, semis), t + 0.25)
  }
}

// --- HUH (pitch downturn square) ---
function buildHuh(): Trigger {
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.1 },
    volume: -14,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    const base = shiftFreq(220, semis)
    synth.frequency.cancelScheduledValues(t)
    synth.frequency.setValueAtTime(base, t)
    synth.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.18)
    synth.triggerAttackRelease(base, 0.22, t, vel)
  }
}

// --- LAZER (frequency sweep down) ---
function buildLazer(): Trigger {
  const synth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0.4, release: 0.05 },
    volume: -16,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    synth.frequency.cancelScheduledValues(t)
    synth.frequency.setValueAtTime(shiftFreq(1800, semis), t)
    synth.frequency.exponentialRampToValueAtTime(shiftFreq(80, semis), t + 0.2)
    synth.triggerAttackRelease(shiftFreq(1800, semis), 0.22, t, vel)
  }
}

// --- COIN (8-bit chime) ---
function buildCoin(): Trigger {
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 1, release: 0.05 },
    volume: -14,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    const n1 = Tone.Frequency('B5').transpose(semis).toNote()
    const n2 = Tone.Frequency('E6').transpose(semis).toNote()
    synth.triggerAttackRelease(n1, 0.06, t, vel)
    synth.triggerAttackRelease(n2, 0.18, t + 0.07, vel)
  }
}

// --- POP (short percussive pop) ---
function buildPop(): Trigger {
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    volume: -8,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    synth.triggerAttackRelease(shiftNote('C4', semis), '32n', time ?? Tone.now(), vel)
  }
}

// --- BELL (FM bell) ---
function buildBell(): Trigger {
  const synth = new Tone.FMSynth({
    harmonicity: 3.01,
    modulationIndex: 14,
    envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.6 },
    modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
    volume: -10,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    synth.triggerAttackRelease(shiftNote('C5', semis), 0.8, time ?? Tone.now(), vel)
  }
}

// --- ALARM (alternating beep) ---
function buildAlarm(): Trigger {
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.05 },
    volume: -16,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    const n1 = Tone.Frequency('A5').transpose(semis).toNote()
    const n2 = Tone.Frequency('E5').transpose(semis).toNote()
    synth.triggerAttackRelease(n1, 0.1, t, vel)
    synth.triggerAttackRelease(n2, 0.1, t + 0.13, vel)
    synth.triggerAttackRelease(n1, 0.1, t + 0.26, vel)
    synth.triggerAttackRelease(n2, 0.1, t + 0.39, vel)
  }
}

// --- SIREN (triangle up/down) ---
function buildSiren(): Trigger {
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.05, sustain: 0.8, release: 0.1 },
    volume: -12,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    const lo = shiftFreq(440, semis)
    const hi = shiftFreq(880, semis)
    synth.frequency.cancelScheduledValues(t)
    synth.frequency.setValueAtTime(lo, t)
    synth.frequency.exponentialRampToValueAtTime(hi, t + 0.25)
    synth.frequency.exponentialRampToValueAtTime(lo, t + 0.5)
    synth.triggerAttackRelease(lo, 0.55, t, vel)
  }
}

// --- DING (high sine bell) ---
function buildDing(): Trigger {
  const synth = new Tone.FMSynth({
    harmonicity: 2,
    modulationIndex: 6,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 },
    modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
    volume: -8,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    synth.triggerAttackRelease(shiftNote('E6', semis), 0.5, time ?? Tone.now(), vel)
  }
}

// --- ERROR (square buzzer) ---
function buildError(): Trigger {
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0.7, release: 0.05 },
    volume: -16,
  }).connect(getPadBus())
  return (time, vel = 1, semis = 0) => {
    const t = time ?? Tone.now()
    const n = Tone.Frequency('C3').transpose(semis).toNote()
    synth.triggerAttackRelease(n, 0.2, t, vel)
    synth.triggerAttackRelease(n, 0.2, t + 0.23, vel)
  }
}

export const PRESETS: Preset[] = [
  { id: 'boom', label: 'BOOM', emoji: '💥', color: '#ef4444', build: buildBoom },
  { id: 'airhorn', label: 'AIR HORN', emoji: '📯', color: '#f97316', build: buildAirhorn },
  { id: 'tada', label: 'TADA', emoji: '🎉', color: '#eab308', build: buildTada },
  { id: 'oof', label: 'OOF', emoji: '💀', color: '#a855f7', build: buildOof },
  { id: 'bruh', label: 'BRUH', emoji: '🗿', color: '#64748b', build: buildBruh },
  { id: 'wow', label: 'WOW', emoji: '😮', color: '#0ea5e9', build: buildWow },
  { id: 'yeah', label: 'YEAH', emoji: '🙌', color: '#22c55e', build: buildYeah },
  { id: 'huh', label: 'HUH?', emoji: '🤔', color: '#14b8a6', build: buildHuh },
  { id: 'lazer', label: 'LAZER', emoji: '⚡', color: '#06b6d4', build: buildLazer },
  { id: 'coin', label: 'COIN', emoji: '🪙', color: '#facc15', build: buildCoin },
  { id: 'pop', label: 'POP', emoji: '🎈', color: '#ec4899', build: buildPop },
  { id: 'bell', label: 'BELL', emoji: '🔔', color: '#fb923c', build: buildBell },
  { id: 'alarm', label: 'ALARM', emoji: '🚨', color: '#dc2626', build: buildAlarm },
  { id: 'siren', label: 'SIREN', emoji: '🚓', color: '#3b82f6', build: buildSiren },
  { id: 'ding', label: 'DING', emoji: '✨', color: '#a3e635', build: buildDing },
  { id: 'error', label: 'ERROR', emoji: '⛔', color: '#7c3aed', build: buildError },
]

export const PRESETS_BY_ID: Record<string, Preset> = Object.fromEntries(
  PRESETS.map((p) => [p.id, p]),
)
