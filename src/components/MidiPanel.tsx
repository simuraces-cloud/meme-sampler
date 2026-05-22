import { useRef } from 'react'
import { PAD_HOTKEYS, useStore } from '../store'

export function MidiPanel() {
  const midi = useStore((s) => s.midi)
  const midiMode = useStore((s) => s.midiMode)
  const midiTargetPad = useStore((s) => s.midiTargetPad)
  const isPlayingMidi = useStore((s) => s.isPlayingMidi)
  const pads = useStore((s) => s.pads)
  const loadMidi = useStore((s) => s.loadMidi)
  const setMidiTargetPad = useStore((s) => s.setMidiTargetPad)
  const setMidiMode = useStore((s) => s.setMidiMode)
  const playMidi = useStore((s) => s.playMidi)
  const stopMidi = useStore((s) => s.stopMidi)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-2xl border border-white/5 bg-black/30 p-4 backdrop-blur">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xs uppercase tracking-[0.25em] text-white/40">
          MIDI · мелодия → пэды
        </h2>
        <span className="font-mono text-[10px] uppercase text-white/30">
          {midi
            ? `${midi.name} · ${midi.notes.length} нот · ${midi.durationSec.toFixed(1)}s`
            : 'нет файла'}
        </span>
        <button
          onClick={() => fileRef.current?.click()}
          className="ml-auto rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs uppercase tracking-widest text-white/60 hover:border-white/30 hover:text-white"
        >
          Load .mid
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".mid,.midi"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) await loadMidi(f)
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
            Режим
          </span>
          <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5">
            <button
              onClick={() => setMidiMode('melody')}
              className={`rounded-md px-2 py-1 text-[11px] uppercase tracking-widest transition ${
                midiMode === 'melody' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
              }`}
              title="Все ноты проигрываются через один пэд с pitch-shift по высоте ноты"
            >
              melody
            </button>
            <button
              onClick={() => setMidiMode('drums')}
              className={`rounded-md px-2 py-1 text-[11px] uppercase tracking-widest transition ${
                midiMode === 'drums' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
              }`}
              title="Ноты распределяются по 16 пэдам по pitch mod 16"
            >
              drums
            </button>
          </div>
        </div>

        {midiMode === 'melody' && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              Pad
            </span>
            <select
              value={midiTargetPad}
              onChange={(e) => setMidiTargetPad(Number(e.target.value))}
              className="rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
            >
              {pads.map((p, i) => (
                <option key={i} value={i} className="bg-zinc-900">
                  {PAD_HOTKEYS[i].toUpperCase()} · {p.emoji} {p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {isPlayingMidi ? (
          <button
            onClick={stopMidi}
            disabled={!midi}
            className="ml-auto rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-xs uppercase tracking-widest text-rose-100 hover:bg-rose-500/30 disabled:opacity-40"
          >
            stop midi
          </button>
        ) : (
          <button
            onClick={() => void playMidi()}
            disabled={!midi}
            className="ml-auto rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-xs uppercase tracking-widest text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            play midi
          </button>
        )}
      </div>

      <p className="mt-2 text-[10px] text-white/30">
        Перетащи .mid файл или нажми <span className="text-white/60">Load .mid</span>. В режиме{' '}
        <span className="text-white/60">melody</span> все ноты звучат выбранным пэдом с
        pitch-shift'ом по высоте; в режиме <span className="text-white/60">drums</span> ноты
        раскладываются по 16 пэдам (pitch mod 16). MIDI работает поверх дрэм-машины и записи.
      </p>
    </div>
  )
}
