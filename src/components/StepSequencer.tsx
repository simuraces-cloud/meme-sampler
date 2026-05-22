import { DRUM_LABEL, DRUM_TRACKS, STEPS } from '../audio/engine'
import { useStore } from '../store'

const TRACK_COLOR: Record<string, string> = {
  kick: '#ef4444',
  snare: '#f59e0b',
  closedHat: '#10b981',
  openHat: '#3b82f6',
}

export function StepSequencer() {
  const pattern = useStore((s) => s.drumPattern)
  const toggle = useStore((s) => s.toggleStep)
  const currentStep = useStore((s) => s.currentStep)
  const isPlaying = useStore((s) => s.isPlaying)

  return (
    <div className="rounded-2xl border border-white/5 bg-black/30 p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xs uppercase tracking-[0.25em] text-white/40">
          Drum machine
        </h2>
        <div className="font-mono text-[10px] uppercase text-white/30">
          16 steps · 4 tracks
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {DRUM_TRACKS.map((track) => (
          <div key={track} className="flex items-center gap-2">
            <div
              className="w-16 shrink-0 text-right font-mono text-xs uppercase tracking-widest"
              style={{ color: TRACK_COLOR[track] }}
            >
              {DRUM_LABEL[track]}
            </div>
            <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
              {pattern[track].map((on, step) => {
                const isPlayhead = isPlaying && currentStep === step
                const isBeat = step % 4 === 0
                return (
                  <button
                    key={step}
                    onClick={() => toggle(track, step)}
                    className={`h-8 rounded-md border transition ${
                      on
                        ? 'border-transparent shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                        : isBeat
                          ? 'border-white/15 bg-white/[0.04] hover:bg-white/[0.08]'
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06]'
                    } ${isPlayhead ? 'ring-2 ring-white/80' : ''}`}
                    style={
                      on
                        ? { background: TRACK_COLOR[track] }
                        : undefined
                    }
                    aria-label={`${track} step ${step + 1}`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
