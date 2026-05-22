import { useStore } from '../store'

export function TransportBar() {
  const isPlaying = useStore((s) => s.isPlaying)
  const bpm = useStore((s) => s.bpm)
  const masterVolDb = useStore((s) => s.masterVolDb)
  const isRecording = useStore((s) => s.isRecording)
  const recordedEventCount = useStore((s) => s.recordedEventCount)
  const isExporting = useStore((s) => s.isExporting)
  const togglePlay = useStore((s) => s.togglePlay)
  const setBpm = useStore((s) => s.setBpm)
  const setMasterVol = useStore((s) => s.setMasterVol)
  const clearDrums = useStore((s) => s.clearDrums)
  const toggleRecord = useStore((s) => s.toggleRecord)
  const clearRecording = useStore((s) => s.clearRecording)
  const generateAiDrums = useStore((s) => s.generateAiDrums)
  const exportLoop = useStore((s) => s.exportLoop)

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-black/30 px-5 py-3 backdrop-blur">
      <button
        onClick={() => void togglePlay()}
        className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold transition ${
          isPlaying
            ? 'bg-rose-500 text-white shadow-[0_0_24px_rgba(244,63,94,0.55)]'
            : 'bg-emerald-400 text-black shadow-[0_0_24px_rgba(52,211,153,0.5)] hover:scale-105'
        }`}
        aria-label={isPlaying ? 'Stop' : 'Play'}
        title="Space"
      >
        {isPlaying ? '■' : '▶'}
      </button>

      <button
        onClick={() => void toggleRecord()}
        className={`flex h-10 items-center gap-2 rounded-full border px-3 text-xs uppercase tracking-widest transition ${
          isRecording
            ? 'border-rose-400 bg-rose-500/20 text-rose-100 shadow-[0_0_18px_rgba(244,63,94,0.4)] animate-pulse'
            : 'border-white/10 bg-black/30 text-white/60 hover:border-white/30 hover:text-white'
        }`}
        title="Запись перфоманса: нажми REC → играй пэдами → нажми снова, чтобы зациклить"
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isRecording ? 'bg-rose-400' : 'bg-white/40'
          }`}
        />
        {isRecording ? `REC · ${recordedEventCount}` : 'REC'}
      </button>

      {!isRecording && recordedEventCount > 0 && (
        <button
          onClick={clearRecording}
          className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[10px] uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white"
          title="Сбросить записанный луп"
        >
          clear rec
        </button>
      )}

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-white/40">BPM</span>
        <input
          type="range"
          min={40}
          max={220}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-36"
        />
        <span className="w-10 text-right font-mono text-lg tabular-nums text-white">
          {bpm}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-white/40">VOL</span>
        <input
          type="range"
          min={-30}
          max={6}
          step={1}
          value={masterVolDb}
          onChange={(e) => setMasterVol(Number(e.target.value))}
          className="w-28"
        />
        <span className="w-12 text-right font-mono text-sm tabular-nums text-white/70">
          {masterVolDb > 0 ? '+' : ''}
          {masterVolDb} dB
        </span>
      </div>

      <button
        onClick={() => generateAiDrums()}
        className="ml-auto rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs uppercase tracking-widest text-fuchsia-200 transition hover:border-fuchsia-400/60 hover:bg-fuchsia-500/20"
        title="Сгенерировать драм-паттерн в случайном стиле"
      >
        AI drums
      </button>

      <button
        onClick={clearDrums}
        className="rounded-lg border border-white/10 px-3 py-2 text-xs uppercase tracking-widest text-white/60 transition hover:border-white/30 hover:text-white"
      >
        Clear drums
      </button>

      <button
        onClick={() => void exportLoop(1)}
        disabled={isExporting}
        className={`rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs uppercase tracking-widest text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Записать 1 такт текущего лупа в WAV"
      >
        {isExporting ? 'rendering…' : 'Export WAV'}
      </button>
    </div>
  )
}
