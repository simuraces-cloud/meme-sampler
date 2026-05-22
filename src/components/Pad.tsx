import { useRef, useState } from 'react'
import { useStore } from '../store'

type Props = {
  index: number
}

export function Pad({ index }: Props) {
  const pad = useStore((s) => s.pads[index])
  const triggeredAt = useStore((s) => s.triggeredAt[index])
  const triggerPad = useStore((s) => s.triggerPad)
  const loadSample = useStore((s) => s.loadSampleToPad)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
        <span className="text-3xl drop-shadow-md">{pad.emoji}</span>
        <span className="mt-1 font-display text-sm font-semibold uppercase tracking-wider drop-shadow">
          {pad.label}
        </span>
        {isSample && (
          <span className="mt-1 max-w-[90%] truncate font-mono text-[10px] text-white/70">
            sample
          </span>
        )}
      </button>

      <button
        onClick={() => fileRef.current?.click()}
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/40 opacity-0 transition group-hover:opacity-100 hover:text-white"
        tabIndex={-1}
        aria-label="Load sample"
      >
        load
      </button>
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
    </div>
  )
}
