import { useStore } from '../store'

export function TransportBar() {
  const isPlaying = useStore((s) => s.isPlaying)
  const bpm = useStore((s) => s.bpm)
  const masterVolDb = useStore((s) => s.masterVolDb)
  const togglePlay = useStore((s) => s.togglePlay)
  const setBpm = useStore((s) => s.setBpm)
  const setMasterVol = useStore((s) => s.setMasterVol)
  const clearDrums = useStore((s) => s.clearDrums)

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/5 bg-black/30 px-5 py-3 backdrop-blur">
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

      <div className="flex items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-widest text-white/40">BPM</span>
        <input
          type="range"
          min={40}
          max={220}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-40"
        />
        <span className="w-10 text-right font-mono text-lg tabular-nums text-white">
          {bpm}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-widest text-white/40">VOL</span>
        <input
          type="range"
          min={-30}
          max={6}
          step={1}
          value={masterVolDb}
          onChange={(e) => setMasterVol(Number(e.target.value))}
          className="w-32"
        />
        <span className="w-12 text-right font-mono text-sm tabular-nums text-white/70">
          {masterVolDb > 0 ? '+' : ''}
          {masterVolDb} dB
        </span>
      </div>

      <button
        onClick={clearDrums}
        className="ml-auto rounded-lg border border-white/10 px-3 py-2 text-xs uppercase tracking-widest text-white/60 transition hover:border-white/30 hover:text-white"
      >
        Clear drums
      </button>
    </div>
  )
}
