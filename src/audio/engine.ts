import * as Tone from 'tone'

let started = false

export async function ensureAudioStarted() {
  if (started) return
  await Tone.start()
  started = true
}

export const masterLimiter = new Tone.Limiter(-1).toDestination()
export const masterVolume = new Tone.Volume(-4).connect(masterLimiter)

const reverb = new Tone.Reverb({ decay: 1.4, wet: 1 }).connect(masterVolume)
const drumBus = new Tone.Gain(1).connect(masterVolume)
const drumReverbSend = new Tone.Gain(0.12).connect(reverb)
drumBus.connect(drumReverbSend)

export function getDrumBus() {
  return drumBus
}

export function getMasterVolume() {
  return masterVolume
}

export function setMasterVolumeDb(db: number) {
  masterVolume.volume.rampTo(db, 0.05)
}

// ---------- Per-pad FX channels ----------

export type PadChannel = {
  input: Tone.Gain
  filter: Tone.Filter
  bitcrusher: Tone.BitCrusher
  reverbSend: Tone.Gain
  outDry: Tone.Gain
}

const padChannels = new Map<number, PadChannel>()

export function getPadChannel(index: number): PadChannel {
  const cached = padChannels.get(index)
  if (cached) return cached
  const input = new Tone.Gain(1)
  const filter = new Tone.Filter({ frequency: 20000, type: 'lowpass', Q: 0.7 })
  const bitcrusher = new Tone.BitCrusher(8)
  bitcrusher.wet.value = 0
  const outDry = new Tone.Gain(1).connect(masterVolume)
  const reverbSend = new Tone.Gain(0.12).connect(reverb)
  input.connect(filter)
  filter.connect(bitcrusher)
  bitcrusher.connect(outDry)
  bitcrusher.connect(reverbSend)
  const ch: PadChannel = { input, filter, bitcrusher, reverbSend, outDry }
  padChannels.set(index, ch)
  return ch
}

export function setPadFilterFreq(index: number, freq: number) {
  getPadChannel(index).filter.frequency.rampTo(freq, 0.03)
}

export function setPadBitcrush(index: number, on: boolean, bits: number) {
  const ch = getPadChannel(index)
  if (on) {
    ch.bitcrusher.bits.value = bits
    ch.bitcrusher.wet.rampTo(1, 0.03)
  } else {
    ch.bitcrusher.wet.rampTo(0, 0.03)
  }
}

export function setPadReverbSend(index: number, amount: number) {
  getPadChannel(index).reverbSend.gain.rampTo(amount, 0.03)
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

// ---------- Recording / export ----------

// Records the master output to a Blob via MediaRecorder.
// Plays the transport for `bars` measures then returns the recording.
export async function recordLoopToBlob(bars = 1): Promise<Blob> {
  const rawCtx = Tone.getContext().rawContext as AudioContext
  const dest = rawCtx.createMediaStreamDestination()
  // Connect master to recorder destination. masterLimiter has `output` of Tone.AudioNode.
  // Use the raw destination connect by tapping masterVolume's output.
  // @ts-expect-error access internal output
  ;(masterVolume.output as AudioNode).connect(dest)
  const recorder = new MediaRecorder(dest.stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      try {
        // @ts-expect-error internal output
        ;(masterVolume.output as AudioNode).disconnect(dest)
      } catch {
        /* ignore */
      }
      resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
    }
    recorder.onerror = (e) => reject(e)
    ensureSequence()
    const wasPlaying = Tone.getTransport().state === 'started'
    if (!wasPlaying) Tone.getTransport().start()
    recorder.start()
    const bpm = Tone.getTransport().bpm.value
    const beatsPerBar = 4
    const totalBeats = bars * beatsPerBar
    const durationSec = (60 / bpm) * totalBeats + 0.3 // small tail for reverb
    setTimeout(() => {
      recorder.stop()
      if (!wasPlaying) Tone.getTransport().stop()
    }, durationSec * 1000)
  })
}

// Encode an AudioBuffer to a WAV Blob (16-bit PCM).
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const numSamples = buffer.length
  const dataSize = numSamples * numCh * 2
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numCh, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numCh * 2, true)
  view.setUint16(32, numCh * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  const channels: Float32Array[] = []
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c))
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]))
      s = s < 0 ? s * 0x8000 : s * 0x7fff
      view.setInt16(offset, s, true)
      offset += 2
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

// Decode an audio Blob into an AudioBuffer (re-using current audio context).
export async function decodeBlobToBuffer(blob: Blob): Promise<AudioBuffer> {
  const arr = await blob.arrayBuffer()
  const rawCtx = Tone.getContext().rawContext as AudioContext
  return await rawCtx.decodeAudioData(arr.slice(0))
}
