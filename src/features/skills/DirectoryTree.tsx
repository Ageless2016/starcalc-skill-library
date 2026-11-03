import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { ChevronRight, Folder as FolderIcon, FolderOpen, FolderPlus, Layers, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { Folder, Skill } from './types'
import { addFolder, deleteFolder, descendantIds, renameFolder } from './store'
import { confirmDialog, cx, toast } from '../../components/ui'

export const UNCATEGORIZED = '__uncategorized'

const WIDTH_KEY = 'starcalc.skill-tree.width'
const DEFAULT_WIDTH = 232
const MIN_WIDTH = 180
const MAX_WIDTH = 480

interface Props {
  folders: Folder[]
  skills: Skill[]
  selected: string | null
  onSelect: (id: string | null) => void
}

type Editing = { mode: 'new'; parentId: string | null } | { mode: 'rename'; id: string } | null

export default function DirectoryTree({ folders, skills, selected, onSelect }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(folders.filter((f) => !f.parentId).map((f) => f.id)))
  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY))
    return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH
  })
  const [resizing, setResizing] = useState(false)

  const startResize = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    let latest = startW
    setResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: globalThis.MouseEvent) => {
      latest = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + ev.clientX - startX))
      setWidth(latest)
    }
    const onUp = () => {
      setResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(WIDTH_KEY, String(latest))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // close the node action menu on outside click, scroll, resize or Escape
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
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
  }, [menu])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of folders) {
      const ids = new Set(descendantIds(folders, f.id))
      m.set(f.id, skills.filter((s) => s.folderId && ids.has(s.folderId)).length)
    }
    return m
  }, [folders, skills])
  const uncategorized = skills.filter((s) => !s.folderId || !folders.some((f) => f.id === s.folderId)).length

  // when searching, show matches plus their ancestors
  const visible = useMemo(() => {
    if (!query.trim()) return null
    const set = new Set<string>()
    for (const f of folders) {
      if (!f.name.toLowerCase().includes(query.trim().toLowerCase())) continue
      let cur: Folder | undefined = f
      while (cur) {
        set.add(cur.id)
        cur = folders.find((x) => x.id === cur!.parentId)
      }
    }
    return set
  }, [folders, query])

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const startNew = (parentId: string | null) => {
    if (parentId) setExpanded((s) => new Set(s).add(parentId))
    setEditing({ mode: 'new', parentId })
    setDraft('')
  }

  const commitEdit = () => {
    if (!editing) return
    const name = draft.trim()
    if (!name) {
      toast('请输入目录名称', 'error')
      return
    }
    if (/[\\/:*?"<>|]/.test(name)) {
      toast('目录名称不能包含特殊字符 \\ / : * ? " < > |', 'error')
      return
    }
    const parentId = editing.mode === 'new' ? editing.parentId : (folders.find((f) => f.id === editing.id)?.parentId ?? null)
    const dup = folders.some((f) => f.parentId === parentId && f.name === name && (editing.mode === 'new' || f.id !== editing.id))
    if (dup) {
      toast('同级目录下已存在同名目录', 'error')
      return
    }
    if (editing.mode === 'new') {
      const f = addFolder(name, parentId)
      onSelect(f.id)
      toast('目录已创建')
    } else renameFolder(editing.id, name)
    setEditing(null)
  }

  const remove = async (f: Folder) => {
    const hasChildren = folders.some((x) => x.parentId === f.id)
    if (hasChildren || (counts.get(f.id) ?? 0) > 0) {
      toast('目录下存在子目录或技能，请先移除后再删除', 'warn')
      return
    }
    const ok = await confirmDialog({ title: '删除目录', content: `确定删除目录「${f.name}」吗？`, okText: '删除', danger: true })
    if (!ok) return
    deleteFolder(f.id)
    if (selected === f.id) onSelect(f.parentId)
    toast('目录已删除')
  }

  const inputRow = (depth: number) => (
    <div className="flex items-center h-8 pr-2" style={{ paddingLeft: 10 + depth * 16 + 16 }}>
      <FolderIcon size={14} className="text-[#8F959E] shrink-0 mr-1.5" />
      <input
        autoFocus
        value={draft}
        maxLength={30}
        placeholder="请输入目录名称"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit()
          if (e.key === 'Escape') setEditing(null)
        }}
        className="flex-1 min-w-0 h-6 px-1.5 text-[13px] border border-brand rounded-[2px] outline-none"
      />
    </div>
  )

  const renderLevel = (parentId: string | null, depth: number) => {
    const children = folders.filter((f) => f.parentId === parentId && (!visible || visible.has(f.id))).sort((a, b) => a.createdAt - b.createdAt)
    return (
      <>
        {children.map((f) => {
          const hasKids = folders.some((x) => x.parentId === f.id)
          const isOpen = expanded.has(f.id) || !!visible
          const isSel = selected === f.id
          if (editing?.mode === 'rename' && editing.id === f.id) return <div key={f.id}>{inputRow(depth)}</div>
          return (
            <div key={f.id}>
              <div
                onClick={() => onSelect(f.id)}
                className={cx('group flex items-center h-8 pr-2 rounded-[3px] cursor-pointer transition-colors', isSel ? 'bg-brand/10 text-brand font-medium' : 'text-ink hover:bg-brand/[0.06]')}
                style={{ paddingLeft: 10 + depth * 16 }}
              >
                <button
                  className={cx('size-4 flex items-center justify-center shrink-0 cursor-pointer', isSel ? 'text-brand/70' : 'text-faint', !hasKids && 'invisible')}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(f.id)
                  }}
                  aria-label={isOpen ? '收起' : '展开'}
                >
                  <ChevronRight size={12} className={cx('transition-transform', isOpen && 'rotate-90')} />
                </button>
                {isOpen && hasKids ? <FolderOpen size={14} className={'shrink-0 mr-1.5 text-[#8F959E]'} /> : <FolderIcon size={14} className={'shrink-0 mr-1.5 text-[#8F959E]'} />}
                <span className="flex-1 min-w-0 truncate text-[13px]">{f.name}</span>
                <span className={cx('text-[11px] tabular-nums', isSel ? 'text-brand/70' : 'text-faint', menu?.id === f.id ? 'hidden' : 'group-hover:hidden')}>{counts.get(f.id) ?? 0}</span>
                <button
                  title="更多操作"
                  aria-label="更多操作"
                  aria-haspopup="menu"
                  aria-expanded={menu?.id === f.id}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (menu?.id === f.id) return setMenu(null)
                    const r = e.currentTarget.getBoundingClientRect()
                    setMenu({ id: f.id, x: r.right, y: r.bottom + 4 })
                  }}
                  className={cx(
                    'size-5 items-center justify-center rounded-[3px] cursor-pointer transition-colors',
                    isSel
                      ? cx(menu?.id === f.id ? 'flex bg-brand/15' : 'hidden group-hover:flex hover:bg-brand/15', 'text-brand')
                      : menu?.id === f.id
                        ? 'flex bg-brand/10 text-brand'
                        : 'hidden group-hover:flex text-muted hover:bg-brand/10 hover:text-brand',
                  )}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
              {isOpen && renderLevel(f.id, depth + 1)}
            </div>
          )
        })}
        {editing?.mode === 'new' && editing.parentId === parentId && inputRow(depth)}
      </>
    )
  }

  return (
    <div className="relative shrink-0 border border-line rounded-[4px] flex flex-col bg-white" style={{ width }}>
      {/* drag handle sits over the right border and the gap next to it */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整目录宽度"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        title="拖拽调整宽度"
        onMouseDown={startResize}
        className="group/resize absolute top-0 bottom-0 -right-[7px] w-3 z-10 cursor-col-resize flex justify-center"
      >
        <span className={cx('w-[2px] h-full rounded-full transition-colors', resizing ? 'bg-brand/85' : 'bg-transparent group-hover/resize:bg-brand/40')} />
      </div>
      <div className="flex items-center justify-between h-10 px-3 border-b border-line">
        <span className="text-[14px] font-medium text-ink">技能目录</span>
        <button title="新增一级目录" onClick={() => startNew(null)} className="text-muted hover:text-brand cursor-pointer">
          <FolderPlus size={15} />
        </button>
      </div>
      <div className="p-2">
        <div className="flex items-center h-7 px-2 gap-1.5 rounded-[3px] bg-canvas">
          <Search size={12} className="text-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索目录" className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-faint" />
        </div>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-2">
        <div
          onClick={() => onSelect(null)}
          className={cx('flex items-center h-8 pl-2.5 pr-2 rounded-[3px] cursor-pointer transition-colors', selected === null ? 'bg-brand/10 text-brand font-medium' : 'text-ink hover:bg-brand/[0.06]')}
        >
          <Layers size={14} className="mr-1.5 shrink-0 text-[#8F959E]" />
          <span className="flex-1 text-[13px] font-medium">全部技能</span>
          <span className={cx('text-[11px] tabular-nums', selected === null ? 'text-brand/70' : 'text-faint')}>{skills.length}</span>
        </div>
        {renderLevel(null, 0)}
        {uncategorized > 0 && !visible && (
          <div
            onClick={() => onSelect(UNCATEGORIZED)}
            className={cx('flex items-center h-8 pr-2 rounded-[3px] cursor-pointer', selected === UNCATEGORIZED ? 'bg-brand/10 text-brand font-medium' : 'text-muted hover:bg-brand/[0.06]')}
            style={{ paddingLeft: 26 }}
          >
            <FolderIcon size={14} className={'mr-1.5 text-[#8F959E]'} />
            <span className="flex-1 text-[13px]">未分类</span>
            <span className={cx('text-[11px]', selected === UNCATEGORIZED ? 'text-brand/70' : 'text-faint')}>{uncategorized}</span>
          </div>
        )}
        {visible && visible.size === 0 && <div className="text-center text-[13px] text-faint py-6">未找到匹配的目录</div>}
      </div>
      {menu &&
        (() => {
          const f = folders.find((x) => x.id === menu.id)
          if (!f) return null
          const item = 'w-full h-8 px-3 flex items-center gap-2 text-[13px] text-left cursor-pointer transition-colors'
          const run = (fn: () => void) => (e: MouseEvent) => {
            e.stopPropagation()
            setMenu(null)
            fn()
          }
          return (
            <div
              role="menu"
              onMouseDown={(e) => e.stopPropagation()}
              className="fixed z-40 w-[132px] py-1 bg-white rounded-[4px] border border-line shadow-[0_6px_20px_rgba(0,0,0,0.12)] animate-[drop_.12s_ease-out]"
              style={{ left: menu.x - 132, top: menu.y }}
            >
              <button role="menuitem" className={cx(item, 'text-ink hover:bg-canvas')} onClick={run(() => startNew(f.id))}>
                <Plus size={13} className="text-muted" />
                新增子目录
              </button>
              <button
                role="menuitem"
                className={cx(item, 'text-ink hover:bg-canvas')}
                onClick={run(() => {
                  setEditing({ mode: 'rename', id: f.id })
                  setDraft(f.name)
                })}
              >
                <Pencil size={12} className="text-muted" />
                重命名
              </button>
              <div className="my-1 h-px bg-line" />
              <button role="menuitem" className={cx(item, 'text-[#E5484D] hover:bg-[#FDECEC]')} onClick={run(() => remove(f))}>
                <Trash2 size={12} />
                删除
              </button>
            </div>
          )
        })()}
    </div>
  )
}
