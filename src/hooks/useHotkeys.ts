import { useEffect } from 'react'
import { useStore, PAD_HOTKEYS } from '../store'

export function useHotkeys() {
  useEffect(() => {
    const held = new Set<string>()

    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      )
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === ' ') {
        e.preventDefault()
        void useStore.getState().togglePlay()
        return
      }
      const idx = PAD_HOTKEYS.indexOf(key)
      if (idx >= 0 && !held.has(key)) {
        held.add(key)
        void useStore.getState().triggerPad(idx)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase())
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
}
