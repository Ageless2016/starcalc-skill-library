import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Info, X, XCircle } from 'lucide-react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export interface MenuAction {
  label: string
  icon?: ReactNode
  danger?: boolean
  /** Render a separator above this item. */
  divided?: boolean
  onSelect: () => void
}

/** Text trigger + floating action menu, rendered in a portal so table/scroll containers never clip it. */
export function Dropdown({ label, items, width = 112, className }: { label: ReactNode; items: MenuAction[]; width?: number; className?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [pos])
  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          if (pos) return setPos(null)
          const r = e.currentTarget.getBoundingClientRect()
          const below = r.bottom + 4 + items.length * 32 + 16 < window.innerHeight
          setPos({ x: Math.max(8, r.right - width), y: below ? r.bottom + 4 : r.top - 4 - items.length * 32 - 8 })
        }}
        className={cx('inline-flex items-center gap-0.5 cursor-pointer', className)}
      >
        {label}
        <ChevronDown size={12} className={cx('transition-transform', pos && 'rotate-180')} />
      </button>
      {pos &&
        createPortal(
          <div
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed z-40 py-1 bg-white rounded-[4px] border border-line shadow-[0_6px_20px_rgba(0,0,0,0.12)] animate-[drop_.12s_ease-out]"
            style={{ left: pos.x, top: pos.y, width }}
          >
            {items.map((it) => (
              <div key={it.label}>
                {it.divided && <div className="my-1 h-px bg-line" />}
                <button
                  role="menuitem"
                  onClick={() => {
                    setPos(null)
                    it.onSelect()
                  }}
                  className={cx(
                    'w-full h-8 px-3 flex items-center gap-2 text-[13px] text-left cursor-pointer transition-colors',
                    it.danger ? 'text-[#E5484D] hover:bg-[#FDECEC]' : 'text-ink hover:bg-canvas',
                  )}
                >
                  {it.icon}
                  {it.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

type Variant = 'primary' | 'outline' | 'link' | 'ghost' | 'danger'

export function Button({
  variant = 'outline',
  className,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  const styles: Record<Variant, string> = {
    primary: 'h-8 px-5 bg-brand/85 text-white hover:bg-brand disabled:bg-[#9AAED3]',
    outline: 'h-8 px-5 border border-brand text-brand bg-white hover:bg-[#F1F5FC] disabled:border-line disabled:text-faint',
    ghost: 'h-8 px-4 border border-line text-ink bg-white hover:border-[#C9CDD4] hover:bg-[#FAFBFC] disabled:text-faint',
    danger: 'h-8 px-5 bg-[#E5484D] text-white hover:bg-[#D13B40]',
    link: 'h-7 px-1 text-link hover:text-[#1546B8] disabled:text-faint disabled:cursor-not-allowed',
  }
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1 rounded-[3px] text-[13px] whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed',
        styles[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function TextInput({ className, icon, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }) {
  return (
    <div
      className={cx(
        'flex items-center h-8 rounded-[3px] border border-line bg-white px-2.5 gap-1.5 focus-within:border-brand transition-colors',
        className,
      )}
    >
      {icon && <span className="text-faint shrink-0">{icon}</span>}
      <input className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-ink placeholder:text-faint" {...rest} />
    </div>
  )
}

export function Select({
  className,
  children,
  placeholder,
  onClear,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string; onClear?: () => void }) {
  const empty = rest.value === '' || rest.value == null
  const clearable = !!onClear && !empty
  return (
    <div className={cx('group relative h-8', className)}>
      <select
        className={cx(
          'appearance-none w-full h-full rounded-[3px] border border-line bg-white pl-2.5 pr-7 text-[13px] outline-none focus:border-brand cursor-pointer',
          placeholder && empty ? 'text-faint' : 'text-ink',
        )}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown size={14} className={cx('absolute right-2 top-1/2 -translate-y-1/2 text-faint pointer-events-none', clearable && 'group-hover:hidden')} />
      {clearable && (
        <button
          type="button"
          aria-label="清空"
          onClick={onClear}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-4 rounded-full hidden group-hover:flex items-center justify-center bg-[#C9CDD4] text-white hover:bg-[#A8ADB5] cursor-pointer"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}

export interface ComboOption {
  value: string
  /** Text shown in the input once selected; also used for keyword matching. */
  label: string
  /** Extra text that keyword search should match (e.g. account id). */
  keywords?: string
  /** Indent level when browsing without a keyword. */
  depth?: number
  /** Short text shown in the list when browsing (defaults to label). */
  short?: string
}

/** Searchable single-select with hover-to-clear; the list renders in a portal so modals never clip it. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  emptyText = '无匹配结果',
  className,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  options: ComboOption[]
  placeholder?: string
  emptyText?: string
  className?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find((o) => o.value === value)
  const q = query.trim().toLowerCase()
  const list = q ? options.filter((o) => `${o.label} ${o.keywords ?? ''}`.toLowerCase().includes(q)) : options

  useLayoutEffect(() => {
    if (!open) return
    const place = () => boxRef.current && setRect(boxRef.current.getBoundingClientRect())
    place()
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as Node
      if (!boxRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false)
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    // capture phase: modals stop mousedown propagation, which would otherwise hide outside clicks
    window.addEventListener('mousedown', onDown, true)
    // clicks outside the preview frame never reach this window; close when it loses focus
    const onBlur = () => setOpen(false)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('mousedown', onDown, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const i = list.findIndex((o) => o.value === value)
    setHi(i >= 0 ? i : 0)
  }, [open, q])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const openList = () => {
    setQuery('')
    setOpen(true)
  }

  return (
    <div
      ref={boxRef}
      className={cx(
        'group relative flex items-center h-8 rounded-[3px] border bg-white pl-2.5 pr-7 transition-colors cursor-text',
        invalid ? 'border-[#E5484D]' : open ? 'border-brand' : 'border-line hover:border-[#C9CDD4]',
        className,
      )}
      onMouseDown={(e) => {
        // React bubbles events from the portalled list through here; only handle clicks on the field itself
        if (!boxRef.current?.contains(e.target as Node)) return
        if (e.target !== inputRef.current) e.preventDefault()
        inputRef.current?.focus()
        if (!open) openList()
        // clicking the field again collapses it, unless the user is placing the caret in a typed keyword
        else if (!(e.target === inputRef.current && query)) setOpen(false)
      }}
    >
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        value={open ? query : (selected?.label ?? '')}
        placeholder={open && selected ? selected.label : placeholder}
        onFocus={() => !open && openList()}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) return openList()
            setHi((h) => Math.min(list.length - 1, h + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHi((h) => Math.max(0, h - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (open && list[hi]) pick(list[hi].value)
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          } else if (e.key === 'Tab') setOpen(false)
        }}
        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-ink placeholder:text-faint"
      />
      <ChevronDown size={14} className={cx('absolute right-2 top-1/2 -translate-y-1/2 text-faint pointer-events-none transition-transform', open && 'rotate-180', selected && 'group-hover:hidden')} />
      {selected && (
        <button
          type="button"
          aria-label="清空"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onChange('')
            setQuery('')
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-4 rounded-full hidden group-hover:flex items-center justify-center bg-[#C9CDD4] text-white hover:bg-[#A8ADB5] cursor-pointer"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
      {open &&
        rect &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            onMouseDown={(e) => e.preventDefault()}
            className="fixed z-[70] max-h-[240px] overflow-auto py-1 bg-white rounded-[4px] border border-line shadow-[0_6px_20px_rgba(0,0,0,0.12)] animate-[drop_.12s_ease-out]"
            style={{ left: rect.left, top: rect.bottom + 4, width: rect.width }}
          >
            {list.length === 0 && <div className="px-3 py-3 text-center text-[13px] text-faint">{emptyText}</div>}
            {list.map((o, i) => {
              const sel = o.value === value
              return (
                <div
                  key={o.value}
                  data-idx={i}
                  role="option"
                  aria-selected={sel}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(o.value)}
                  className={cx('flex items-center h-8 pr-3 text-[13px] cursor-pointer', i === hi && 'bg-brand/[0.06]', sel ? 'text-brand font-medium' : 'text-ink')}
                  style={{ paddingLeft: 12 + (q ? 0 : (o.depth ?? 0) * 16) }}
                >
                  <span className="flex-1 truncate">{q ? o.label : (o.short ?? o.label)}</span>
                  {sel && <Check size={13} className="shrink-0 ml-2" />}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}

export function Checkbox({ checked, indeterminate, onChange, disabled }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cx(
        'size-3.5 rounded-[2px] border flex items-center justify-center transition-colors cursor-pointer',
        checked || indeterminate ? 'bg-brand border-brand' : 'border-[#D0D3D9] bg-white hover:border-brand',
      )}
    >
      {checked && !indeterminate && (
        <svg viewBox="0 0 12 12" className="size-2.5 text-white">
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {indeterminate && <span className="w-1.5 h-[1.5px] bg-white" />}
    </button>
  )
}

export function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string | null; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-x-3 items-start">
      <label className="text-[13px] text-ink leading-8 text-right">
        {required && <span className="text-[#E5484D] mr-0.5">*</span>}
        {label}
      </label>
      <div className="min-w-0">
        {children}
        <div className={cx('text-[11px] leading-4 mt-1 min-h-4', error ? 'text-[#E5484D]' : 'text-faint')}>{error || hint}</div>
      </div>
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 560,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] animate-[fade_.15s_ease-out]" onMouseDown={onClose}>
      <div
        className="bg-white rounded-[4px] shadow-[0_12px_40px_rgba(0,0,0,0.18)] flex flex-col max-h-[86vh] animate-[pop_.18s_ease-out]"
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between h-12 px-5 border-b border-line shrink-0">
          <div className="text-[14px] font-medium text-ink">{title}</div>
          <button className="text-faint hover:text-ink cursor-pointer" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5 overflow-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-line shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

export function Pagination({
  total,
  page,
  pageSize,
  onChange,
  simple = false,
}: {
  total: number
  page: number
  pageSize: number
  onChange: (page: number, size: number) => void
  simple?: boolean
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const [jump, setJump] = useState(String(page))
  useEffect(() => setJump(String(page)), [page])
  const items: (number | '…')[] = []
  if (pages <= 7) for (let i = 1; i <= pages; i++) items.push(i)
  else {
    const start = Math.max(2, Math.min(page - 2, pages - 5))
    const end = Math.min(pages - 1, start + 4)
    items.push(1)
    if (start > 2) items.push('…')
    for (let i = start; i <= end; i++) items.push(i)
    if (end < pages - 1) items.push('…')
    items.push(pages)
  }
  const box = 'min-w-6 h-6 px-1.5 rounded-[2px] text-[13px] flex items-center justify-center cursor-pointer transition-colors'
  return (
    <div className="flex items-center justify-end gap-1.5 text-[13px] text-ink">
      <span className="mr-2">共 {total} 条</span>
      <button className={cx(box, 'bg-[#F2F3F5] text-muted disabled:text-[#C9CDD4] disabled:cursor-not-allowed')} disabled={page <= 1} onClick={() => onChange(page - 1, pageSize)} aria-label="上一页">
        <ChevronLeft size={12} />
      </button>
      {items.map((it, i) =>
        it === '…' ? (
          <span key={`e${i}`} className={cx(box, 'bg-[#F2F3F5] cursor-default')}>…</span>
        ) : (
          <button key={it} className={cx(box, it === page ? 'bg-brand/85 text-white font-medium' : 'bg-[#F2F3F5] hover:text-brand')} onClick={() => onChange(it, pageSize)}>
            {it}
          </button>
        ),
      )}
      <button className={cx(box, 'bg-[#F2F3F5] text-muted disabled:text-[#C9CDD4] disabled:cursor-not-allowed')} disabled={page >= pages} onClick={() => onChange(page + 1, pageSize)} aria-label="下一页">
        <ChevronRight size={12} />
      </button>
      {!simple && (
        <>
          <Select className="w-[92px] ml-2 !h-6" value={pageSize} onChange={(e) => onChange(1, Number(e.target.value))}>
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}条/页
              </option>
            ))}
          </Select>
          <span className="ml-2">跳至</span>
          <input
            className="w-12 h-6 rounded-[2px] border border-line text-center outline-none focus:border-brand"
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onChange(Math.min(pages, Math.max(1, Number(jump) || 1)), pageSize)
            }}
          />
          <span>页</span>
        </>
      )}
    </div>
  )
}

/* ---------- toast & confirm (global overlays) ---------- */

type ToastType = 'success' | 'error' | 'info' | 'warn'
interface ToastItem {
  id: number
  type: ToastType
  text: string
}
interface ConfirmReq {
  title: string
  content: ReactNode
  okText?: string
  danger?: boolean
  resolve: (v: boolean) => void
}

let toasts: ToastItem[] = []
let confirmReq: ConfirmReq | null = null
const subs = new Set<() => void>()
let snapshot: { toasts: ToastItem[]; confirmReq: ConfirmReq | null } = { toasts, confirmReq }
const refresh = () => {
  snapshot = { toasts, confirmReq }
  subs.forEach((s) => s())
}

export function toast(text: string, type: ToastType = 'success') {
  const id = Date.now() + Math.random()
  toasts = [...toasts, { id, type, text }]
  refresh()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    refresh()
  }, 2600)
}

export function confirmDialog(opts: Omit<ConfirmReq, 'resolve'>) {
  return new Promise<boolean>((resolve) => {
    confirmReq = { ...opts, resolve }
    refresh()
  })
}

export function Overlays() {
  const s = useSyncExternalStore(
    (l) => {
      subs.add(l)
      return () => subs.delete(l)
    },
    () => snapshot,
  )
  const close = (v: boolean) => {
    s.confirmReq?.resolve(v)
    confirmReq = null
    refresh()
  }
  const icons = {
    success: <CheckCircle2 size={15} className="text-[#12A150]" />,
    error: <XCircle size={15} className="text-[#E5484D]" />,
    warn: <AlertTriangle size={15} className="text-[#F59E0B]" />,
    info: <Info size={15} className="text-link" />,
  }
  return (
    <>
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
        {s.toasts.map((t) => (
          <div key={t.id} className="flex items-center gap-2 bg-white px-4 py-2 rounded-[4px] shadow-[0_6px_20px_rgba(0,0,0,0.12)] text-[13px] text-ink animate-[drop_.2s_ease-out]">
            {icons[t.type]}
            {t.text}
          </div>
        ))}
      </div>
      <Modal
        open={!!s.confirmReq}
        width={420}
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} className={s.confirmReq?.danger ? 'text-[#E5484D]' : 'text-[#F59E0B]'} />
            {s.confirmReq?.title}
          </span>
        }
        onClose={() => close(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              取消
            </Button>
            <Button variant={s.confirmReq?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {s.confirmReq?.okText ?? '确定'}
            </Button>
          </>
        }
      >
        <div className="text-[14px] text-muted leading-6">{s.confirmReq?.content}</div>
      </Modal>
    </>
  )
}
