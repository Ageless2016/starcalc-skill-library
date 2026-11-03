import { useState, type ReactNode } from 'react'
import { ChevronRight, Download, FileCode2, FileImage, FileText, File as FileIcon, Folder, FolderOpen, Pencil, Plus, Puzzle, Trash2, Upload } from 'lucide-react'
import type { SkillFile } from '../types'
import { SKILL_MD, STANDARD_DIRS, extOf } from '../spec'
import { cx } from '../../../components/ui'

export interface TNode {
  name: string
  path: string
  type: 'dir' | 'file'
  children: TNode[]
}

const DIR_ORDER = STANDARD_DIRS.map((d) => d.name)

export function buildTree(files: SkillFile[], dirs: string[]): TNode[] {
  const root: TNode = { name: '', path: '', type: 'dir', children: [] }
  const ensureDir = (path: string) => {
    let cur = root
    let acc = ''
    for (const part of path.split('/').filter(Boolean)) {
      acc = acc ? `${acc}/${part}` : part
      let next = cur.children.find((c) => c.type === 'dir' && c.name === part)
      if (!next) {
        next = { name: part, path: acc, type: 'dir', children: [] }
        cur.children.push(next)
      }
      cur = next
    }
    return cur
  }
  dirs.forEach(ensureDir)
  for (const f of files) {
    const parts = f.path.split('/')
    const name = parts.pop()!
    ensureDir(parts.join('/')).children.push({ name, path: f.path, type: 'file', children: [] })
  }
  const sort = (n: TNode) => {
    n.children.sort((a, b) => {
      if (a.path === SKILL_MD) return -1
      if (b.path === SKILL_MD) return 1
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      const ia = DIR_ORDER.indexOf(a.path)
      const ib = DIR_ORDER.indexOf(b.path)
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      return a.name.localeCompare(b.name)
    })
    n.children.forEach(sort)
  }
  sort(root)
  return root.children
}

export function fileIcon(path: string, size = 14): ReactNode {
  if (path === SKILL_MD) return <Puzzle size={size} className="text-accent shrink-0" />
  const ext = extOf(path)
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return <FileImage size={size} className="text-[#12A150] shrink-0" />
  if (['md', 'txt'].includes(ext)) return <FileText size={size} className="text-link shrink-0" />
  if (['py', 'sh', 'js', 'ts', 'mjs', 'json', 'yaml', 'yml', 'sql', 'bash'].includes(ext)) return <FileCode2 size={size} className="text-[#8B5CF6] shrink-0" />
  return <FileIcon size={size} className="text-muted shrink-0" />
}

interface Props {
  nodes: TNode[]
  rootName: string
  activePath: string
  dirtyPaths: Set<string>
  readOnly?: boolean
  onOpenFile: (path: string) => void
  onNewFile: (dir: string) => void
  onUpload: (dir: string) => void
  onRename: (node: TNode) => void
  onDelete: (node: TNode) => void
  onDownload: (path: string) => void
}

export default function FileTree(props: Props) {
  const { nodes, rootName, activePath, dirtyPaths, onOpenFile } = props
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (p: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })

  const actionBtn = (title: string, icon: ReactNode, fn: () => void, danger?: boolean) => (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        fn()
      }}
      className={cx('cursor-pointer text-muted', danger ? 'hover:text-[#E5484D]' : 'hover:text-brand')}
    >
      {icon}
    </button>
  )

  const render = (list: TNode[], depth: number): ReactNode =>
    list.map((n) => {
      const pad = { paddingLeft: 8 + depth * 14 }
      if (n.type === 'dir') {
        const open = !collapsed.has(n.path)
        return (
          <div key={n.path}>
            <div
              style={pad}
              onClick={() => toggle(n.path)}
              className="group flex items-center h-7 pr-2 rounded-[3px] cursor-pointer text-[13px] hover:bg-brand/[0.06]"
            >
              <ChevronRight size={12} className={cx('text-faint shrink-0 transition-transform mr-0.5', open && 'rotate-90', !n.children.length && 'opacity-0')} />
              {open && n.children.length ? <FolderOpen size={14} className="text-brand/85 shrink-0" /> : <Folder size={14} className="text-brand/85 shrink-0" />}
              <span className="ml-1.5 flex-1 truncate text-ink">{n.name}</span>
              <span className="hidden group-hover:flex items-center gap-1.5">
                {!props.readOnly && actionBtn('在此新建文件', <Plus size={13} />, () => props.onNewFile(n.path))}
                {!props.readOnly && actionBtn('上传文件到此目录', <Upload size={12} />, () => props.onUpload(n.path))}
                {!props.readOnly && actionBtn('重命名', <Pencil size={11} />, () => props.onRename(n))}
                {!props.readOnly && actionBtn('删除', <Trash2 size={12} />, () => props.onDelete(n), true)}
              </span>
            </div>
            {open && render(n.children, depth + 1)}
            {open && !n.children.length && (
              <div style={{ paddingLeft: 8 + (depth + 1) * 14 + 16 }} className="h-6 flex items-center text-[11px] text-faint">
                空目录
              </div>
            )}
          </div>
        )
      }
      const active = activePath === n.path
      const isRoot = n.path === SKILL_MD
      return (
        <div
          key={n.path}
          style={{ paddingLeft: 8 + depth * 14 + 14 }}
          onClick={() => onOpenFile(n.path)}
          className={cx('group flex items-center h-7 pr-2 rounded-[3px] cursor-pointer text-[13px]', active ? 'bg-brand/10 text-brand font-medium' : 'text-ink hover:bg-brand/[0.06]')}
        >
          {fileIcon(n.path)}
          <span className={cx('ml-1.5 flex-1 truncate', isRoot && 'font-medium')}>{n.name}</span>
          {dirtyPaths.has(n.path) && <span className={cx('size-1.5 rounded-full mr-1 group-hover:hidden', 'bg-accent')} title="未保存" />}
          <span className="hidden group-hover:flex items-center gap-1.5">
            {actionBtn('下载', <Download size={12} />, () => props.onDownload(n.path))}
            {!isRoot && !props.readOnly && actionBtn('重命名', <Pencil size={11} />, () => props.onRename(n))}
            {!isRoot && !props.readOnly && actionBtn('删除', <Trash2 size={12} />, () => props.onDelete(n), true)}
          </span>
        </div>
      )
    })

  return (
    <div className="text-[13px]">
      <div className="group flex items-center h-7 px-2 rounded-[3px]">
        <FolderOpen size={14} className="text-brand/85 shrink-0" />
        <span className="ml-1.5 flex-1 font-mono font-medium text-ink truncate">{rootName}</span>
        <span className="hidden group-hover:flex items-center gap-1.5">
          {!props.readOnly && actionBtn('在此新建文件', <Plus size={13} />, () => props.onNewFile(''))}
          {!props.readOnly && actionBtn('上传文件到根目录', <Upload size={12} />, () => props.onUpload(''))}
        </span>
      </div>
      {render(nodes, 1)}
    </div>
  )
}
