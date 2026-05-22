import { Pad } from './Pad'
import { useStore } from '../store'

export function PadGrid() {
  const pads = useStore((s) => s.pads)
  return (
    <div className="grid grid-cols-4 gap-3 sm:gap-4">
      {pads.map((_, i) => (
        <Pad key={i} index={i} />
      ))}
    </div>
  )
}
