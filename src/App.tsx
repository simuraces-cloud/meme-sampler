import { useEffect, useState } from 'react'
import { PadGrid } from './components/PadGrid'
import { StepSequencer } from './components/StepSequencer'
import { TransportBar } from './components/TransportBar'
import { useHotkeys } from './hooks/useHotkeys'
import { ensureAudioStarted } from './audio/engine'

function App() {
  useHotkeys()
  const [needsStart, setNeedsStart] = useState(true)

  useEffect(() => {
    const onFirstInteract = async () => {
      await ensureAudioStarted()
      setNeedsStart(false)
    }
    if (needsStart) {
      window.addEventListener('pointerdown', onFirstInteract, { once: true })
      window.addEventListener('keydown', onFirstInteract, { once: true })
    }
    return () => {
      window.removeEventListener('pointerdown', onFirstInteract)
      window.removeEventListener('keydown', onFirstInteract)
    }
  }, [needsStart])

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-5 p-4 sm:p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text font-display text-3xl font-bold uppercase tracking-tight text-transparent sm:text-4xl">
            Meme Sampler
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Жми пэды мышкой или клавишами, нарисуй бит, заверни в луп. Перетащи свой звук на пэд — он
            заменит пресет.
          </p>
        </div>
        <a
          href="https://github.com/"
          className="hidden text-xs uppercase tracking-widest text-white/30 hover:text-white sm:inline"
          aria-label="GitHub"
        >
          v0.1 · MVP
        </a>
      </header>

      <TransportBar />

      <section>
        <h2 className="mb-2 font-display text-xs uppercase tracking-[0.25em] text-white/40">
          Pads · 4 × 4
        </h2>
        <PadGrid />
      </section>

      <StepSequencer />

      <footer className="pb-6 pt-2 text-center font-mono text-[10px] uppercase tracking-widest text-white/30">
        Space — play/stop · 1234/QWER/ASDF/ZXCV — пэды · drag audio файл на пэд — заменить звук
      </footer>

      {needsStart && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-6">
          <div className="rounded-full bg-white/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white/70 backdrop-blur">
            кликни или нажми клавишу, чтобы запустить аудио
          </div>
        </div>
      )}
    </div>
  )
}

export default App
