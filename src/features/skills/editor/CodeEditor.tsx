import { useRef, type KeyboardEvent } from 'react'

export default function CodeEditor({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const gutter = useRef<HTMLDivElement>(null)
  const lines = value.split('\n').length

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart: s, selectionEnd: end } = el
    const next = value.slice(0, s) + '  ' + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2))
  }

  return (
    <div className="h-full flex font-mono text-[12.5px] leading-[20px] bg-white">
      <div ref={gutter} className="shrink-0 overflow-hidden select-none text-right py-3 pl-3 pr-2.5 text-[#B5B9C0] bg-[#FAFBFC] border-r border-line tabular-nums">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
        <div className="h-4" />
      </div>
      <textarea
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        wrap="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop
        }}
        className="flex-1 min-w-0 resize-none outline-none py-3 px-4 whitespace-pre overflow-auto text-ink caret-brand selection:bg-[#D6E4FF]"
      />
    </div>
  )
}
