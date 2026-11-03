import { useEffect, useRef, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { cx } from '../../../components/ui'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const key = (k: string) => (isMac ? k.replace('Ctrl', '⌘').replace('Alt', '⌥').replace('Shift', '⇧') : k)

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: '段落',
    items: [
      ['正文', 'Ctrl+Alt+0'],
      ['一级 ~ 六级标题', 'Ctrl+Alt+1~6'],
      ['无序列表', 'Ctrl+Alt+8'],
      ['有序列表', 'Ctrl+Alt+7'],
      ['引用', 'Ctrl+Shift+B'],
      ['代码块', 'Ctrl+Alt+C'],
      ['列表缩进 / 取消缩进', 'Tab / Shift+Tab'],
      ['块内换行', 'Shift+Enter'],
    ],
  },
  {
    title: '文本',
    items: [
      ['加粗', 'Ctrl+B'],
      ['斜体', 'Ctrl+I'],
      ['删除线', 'Ctrl+Alt+X'],
      ['行内代码', 'Ctrl+E'],
      ['链接（先选中文字）', 'Ctrl+K'],
    ],
  },
  {
    title: '通用',
    items: [
      ['插入块（标题、表格、图片…）', '/'],
      ['撤销 / 重做', 'Ctrl+Z / Ctrl+Shift+Z'],
      ['切换源码模式', 'Ctrl+/'],
      ['保存', 'Ctrl+S'],
    ],
  },
]

export default function ShortcutHelp() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close, true)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close, true)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        title="快捷键"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx('h-7 px-2 flex items-center gap-1 rounded-[3px] text-[13px] cursor-pointer transition-colors', open ? 'bg-brand/10 text-brand' : 'text-muted hover:text-brand hover:bg-canvas')}
      >
        <Keyboard size={14} />
        快捷键
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-[300px] max-h-[70vh] overflow-auto rounded-[4px] border border-line bg-white shadow-[0_6px_20px_rgba(0,0,0,0.12)] p-3 animate-[drop_.12s_ease-out]">
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-2 last:mb-0">
              <div className="text-[12px] text-faint mb-1">{g.title}</div>
              {g.items.map(([label, k]) => (
                <div key={label} className="flex items-center justify-between h-7 text-[13px] text-ink">
                  <span>{label}</span>
                  <span className="flex gap-1">
                    {key(k)
                      .split(' / ')
                      .map((part) => (
                        <kbd key={part} className="px-1.5 h-5 leading-5 rounded-[3px] border border-line bg-canvas font-mono text-[11px] text-muted">
                          {part}
                        </kbd>
                      ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-line text-[12px] text-muted leading-5">
            也支持直接输入 Markdown 语法自动转换，如 <code className="font-mono">## </code>、<code className="font-mono">- </code>、<code className="font-mono">&gt; </code>、<code className="font-mono">```</code>、<code className="font-mono">**文字**</code>。
          </div>
        </div>
      )}
    </div>
  )
}
