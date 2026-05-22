import { useEffect, useRef, useState } from 'react'
import { PAD_HOTKEYS, useStore, type AudioTrackData } from '../store'

export function AudioTrackPanel() {
  const audioTrack = useStore((s) => s.audioTrack)
  const loadAudioTrack = useStore((s) => s.loadAudioTrack)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-2xl border border-white/5 bg-black/30 p-4 backdrop-blur">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xs uppercase tracking-[0.25em] text-white/40">
          Аудио-дорожка · чопы → пэды
        </h2>
        <span className="font-mono text-[10px] uppercase text-white/30">
          {audioTrack
            ? `${audioTrack.name} · ${audioTrack.durationSec.toFixed(1)}s`
            : 'нет файла'}
        </span>
        <button
          onClick={() => fileRef.current?.click()}
          className="ml-auto rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs uppercase tracking-widest text-white/60 hover:border-white/30 hover:text-white"
        >
          Load audio
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) await loadAudioTrack(f)
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
      </div>

      {audioTrack ? (
        <ChopEditor key={audioTrack.name} track={audioTrack} />
      ) : (
        <p className="text-xs text-white/40">
          Загрузи длинный аудиофайл (например, кусок песни или речи), нарежь ползунками и привяжи
          куски к пэдам.
        </p>
      )}
    </div>
  )
}

function ChopEditor({ track }: { track: AudioTrackData }) {
  const pads = useStore((s) => s.pads)
  const assignChopToPad = useStore((s) => s.assignChopToPad)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [chopStart, setChopStart] = useState(0)
  const [chopEnd, setChopEnd] = useState(() => Math.min(2, track.durationSec))
  const [targetPad, setTargetPad] = useState(0)
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null)

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    ctx.fillRect(0, 0, W, H)
    const peaks = track.peaks
    ctx.fillStyle = 'rgba(192, 132, 252, 0.6)'
    const barW = W / peaks.length
    for (let i = 0; i < peaks.length; i++) {
      const h = peaks[i] * H * 0.9
      ctx.fillRect(i * barW, (H - h) / 2, Math.max(1, barW - 0.5), h)
    }
    const sx = (chopStart / track.durationSec) * W
    const ex = (chopEnd / track.durationSec) * W
    ctx.fillStyle = 'rgba(52, 211, 153, 0.18)'
    ctx.fillRect(sx, 0, ex - sx, H)
    ctx.fillStyle = '#34d399'
    ctx.fillRect(sx - 1, 0, 2, H)
    ctx.fillRect(ex - 1, 0, 2, H)
  }, [track, chopStart, chopEnd])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const xToSec = (clientX: number) => {
      const rect = canvas.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
      return (x / rect.width) * track.durationSec
    }
    const onDown = (e: MouseEvent) => {
      const sec = xToSec(e.clientX)
      const dStart = Math.abs(sec - chopStart)
      const dEnd = Math.abs(sec - chopEnd)
      if (dStart < dEnd) {
        setDragging('start')
        setChopStart(Math.min(sec, chopEnd - 0.02))
      } else {
        setDragging('end')
        setChopEnd(Math.max(sec, chopStart + 0.02))
      }
    }
    canvas.addEventListener('mousedown', onDown)
    return () => canvas.removeEventListener('mousedown', onDown)
  }, [track, chopStart, chopEnd])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
      const sec = (x / rect.width) * track.durationSec
      if (dragging === 'start') setChopStart(Math.min(sec, chopEnd - 0.02))
      else setChopEnd(Math.max(sec, chopStart + 0.02))
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, track, chopStart, chopEnd])

  return (
    <>
      <canvas
        ref={canvasRef}
        width={1000}
        height={120}
        className="w-full cursor-ew-resize rounded-lg border border-white/10 bg-black/40"
        style={{ height: 120 }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
            Start
          </span>
          <input
            type="number"
            min={0}
            max={track.durationSec}
            step={0.01}
            value={chopStart.toFixed(2)}
            onChange={(e) =>
              setChopStart(Math.max(0, Math.min(chopEnd - 0.02, Number(e.target.value))))
            }
            className="w-20 rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-xs text-white"
          />
          <span className="font-mono text-[10px] text-white/40">s</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
            End
          </span>
          <input
            type="number"
            min={0}
            max={track.durationSec}
            step={0.01}
            value={chopEnd.toFixed(2)}
            onChange={(e) =>
              setChopEnd(
                Math.min(track.durationSec, Math.max(chopStart + 0.02, Number(e.target.value))),
              )
            }
            className="w-20 rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-xs text-white"
          />
          <span className="font-mono text-[10px] text-white/40">s</span>
        </div>

        <span className="font-mono text-[10px] text-white/40">
          len {(chopEnd - chopStart).toFixed(2)}s
        </span>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
            Назначить на
          </span>
          <select
            value={targetPad}
            onChange={(e) => setTargetPad(Number(e.target.value))}
            className="rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
          >
            {pads.map((p, i) => (
              <option key={i} value={i} className="bg-zinc-900">
                {PAD_HOTKEYS[i].toUpperCase()} · {p.emoji} {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void assignChopToPad(targetPad, chopStart, chopEnd)}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs uppercase tracking-widest text-emerald-100 hover:bg-emerald-500/25"
          >
            assign
          </button>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-white/30">
        Тяни зелёные ползунки на волне, чтобы выделить кусок, выбери пэд и нажми{' '}
        <span className="text-white/60">assign</span>. На пэде появится значок{' '}
        <span className="text-white/60">chop</span> — он будет проигрывать этот кусок при нажатии
        или из MIDI/recording'а.
      </p>
    </>
  )
}
