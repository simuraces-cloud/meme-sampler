import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

type Props = {
  index: number
}

export function Pad({ index }: Props) {
  const pad = useStore((s) => s.pads[index])
  const triggeredAt = useStore((s) => s.triggeredAt[index])
  const fx = useStore((s) => s.padFx[index])
  const triggerPad = useStore((s) => s.triggerPad)
  const loadSample = useStore((s) => s.loadSampleToPad)
  const setPadFx = useStore((s) => s.setPadFx)
  const resetPadFx = useStore((s) => s.resetPadFx)
  const [drag, setDrag] = useState(false)
  const [fxOpen, setFxOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!fxOpen) return
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setFxOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [fxOpen])

  const onClick = () => {
    void triggerPad(index)
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      await loadSample(index, file)
    }
  }

  const isSample = pad.source.kind === 'sample'
  const isChop = pad.source.kind === 'chop'
  const fxActive =
    fx &&
    (fx.pitch !== 0 ||
      fx.filterFreq < 19000 ||
      fx.bitcrushOn ||
      Math.abs(fx.reverbSend - 0.12) > 0.01 ||
      Math.abs(fx.gain - 1) > 0.01)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className="group relative"
    >
      <button
        key={triggeredAt ?? 0}
        onClick={onClick}
        onMouseDown={(e) => e.preventDefault()}
        className={`relative flex h-32 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 text-white shadow-lg transition select-none ${
          drag
            ? 'border-dashed border-white scale-[1.02]'
            : 'border-white/10 hover:border-white/30'
        } animate-pad-pop`}
        style={{
          background: `linear-gradient(135deg, ${pad.color}cc 0%, ${pad.color}66 100%)`,
          boxShadow: `0 8px 24px -8px ${pad.color}aa, inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}
      >
        <span
          className="absolute right-2 top-2 rounded-md bg-black/30 px-2 py-0.5 font-mono text-[10px] uppercase text-white/80"
          aria-hidden
        >
          {pad.hotkey.toUpperCase()}
        </span>
        {fxActive && (
          <span
            className="absolute left-2 top-2 rounded-md bg-fuchsia-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white"
            title="FX active"
          >
            fx
          </span>
        )}
        <span className="text-3xl drop-shadow-md">{pad.emoji}</span>
        <span className="mt-1 max-w-[90%] truncate font-display text-sm font-semibold uppercase tracking-wider drop-shadow">
          {pad.label}
        </span>
        {(isSample || isChop) && (
          <span className="mt-1 max-w-[90%] truncate font-mono text-[10px] text-white/70">
            {isSample ? 'sample' : 'chop'}
          </span>
        )}
      </button>

      <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 translate-y-full gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
          tabIndex={-1}
          aria-label="Load sample"
        >
          load
        </button>
        <button
          onClick={() => setFxOpen((v) => !v)}
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
            fxOpen || fxActive
              ? 'border-fuchsia-300/50 bg-fuchsia-500/20 text-fuchsia-100'
              : 'border-white/10 bg-black/60 text-white/40 hover:text-white'
          }`}
          tabIndex={-1}
          aria-label="Pad FX"
        >
          fx
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) await loadSample(index, f)
          if (fileRef.current) fileRef.current.value = ''
        }}
      />

      {fxOpen && fx && (
        <div
          ref={popRef}
          className="absolute left-1/2 top-full z-30 mt-8 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-950/95 p-3 text-white shadow-2xl backdrop-blur"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              FX · {pad.label}
            </span>
            <button
              onClick={() => resetPadFx(index)}
              className="rounded border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
            >
              reset
            </button>
          </div>

          <FxRow label="Pitch" value={`${fx.pitch > 0 ? '+' : ''}${fx.pitch}`}>
            <input
              type="range"
              min={-24}
              max={24}
              step={1}
              value={fx.pitch}
              onChange={(e) => setPadFx(index, { pitch: Number(e.target.value) })}
              className="w-full"
            />
          </FxRow>

          <FxRow label="Filter" value={`${Math.round(fx.filterFreq)} Hz`}>
            <input
              type="range"
              min={80}
              max={20000}
              step={20}
              value={fx.filterFreq}
              onChange={(e) => setPadFx(index, { filterFreq: Number(e.target.value) })}
              className="w-full"
            />
          </FxRow>

          <div className="mb-2 flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 text-[11px] uppercase tracking-widest text-white/60">
              <input
                type="checkbox"
                checked={fx.bitcrushOn}
                onChange={(e) => setPadFx(index, { bitcrushOn: e.target.checked })}
              />
              Bitcrush
            </label>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={fx.bitcrushBits}
              onChange={(e) => setPadFx(index, { bitcrushBits: Number(e.target.value) })}
              disabled={!fx.bitcrushOn}
              className="w-24"
            />
            <span className="w-6 text-right font-mono text-[11px] tabular-nums text-white/60">
              {fx.bitcrushBits}b
            </span>
          </div>

          <FxRow label="Reverb" value={`${Math.round(fx.reverbSend * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={fx.reverbSend}
              onChange={(e) => setPadFx(index, { reverbSend: Number(e.target.value) })}
              className="w-full"
            />
          </FxRow>

          <FxRow label="Gain" value={`${(fx.gain).toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.01}
              value={fx.gain}
              onChange={(e) => setPadFx(index, { gain: Number(e.target.value) })}
              className="w-full"
            />
          </FxRow>
        </div>
      )}
    </div>
  )
}

function FxRow({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <div className="flex-1">{children}</div>
      <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/60">
        {value}
      </span>
    </div>
  )
}
