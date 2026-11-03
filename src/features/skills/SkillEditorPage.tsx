import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Code2, Download, FilePlus2, FolderPlus, Info, PencilLine, Puzzle, Save, Send, Settings2, Upload,
} from 'lucide-react'
import { Button, confirmDialog, cx, toast } from '../../components/ui'
import type { SkillFile } from './types'
import { publishSkill, saveSkillFiles, setEditorDirty, useSkillState } from './store'
import { SKILL_MD, extOf, fileSize, formatBytes, joinFrontmatter, parseFrontmatter, relativePath, resolveRelative, setFrontmatterFields, splitFrontmatter, templateForFile, validateSkill } from './spec'
import { downloadFile, exportSkills, readUploadedFile } from './zip'
import { userLabel } from './users'
import { formatTime } from './time'
import FileTree, { buildTree, fileIcon, type TNode } from './editor/FileTree'
import CodeEditor from './editor/CodeEditor'
import ShortcutHelp from './editor/ShortcutHelp'
import PathModal from './editor/PathModal'
import SkillFormModal from './SkillFormModal'
import VersionDrawer from './VersionDrawer'

// the WYSIWYG editor is large; load it only when a Markdown file is opened
const MarkdownEditor = lazy(() => import('./editor/MarkdownEditor'))

type PathDialog = { kind: 'file' | 'dir'; base: string } | { kind: 'rename'; node: TNode } | null

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico']
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon' }

function checkPath(p: string): string | null {
  if (!p) return '请输入路径'
  if (p.startsWith('/') || p.endsWith('/')) return '路径不能以 / 开头或结尾'
  const parts = p.split('/')
  if (parts.some((x) => !x || x === '.' || x === '..')) return '路径格式不正确'
  if (/[\\:*?"<>|]/.test(p)) return '路径不能包含特殊字符 \\ : * ? " < > |'
  return null
}

interface PageProps {
  skillId: string
  active: boolean
  mode: 'view' | 'edit'
  onModeChange: (mode: 'view' | 'edit') => void
  onBack: () => void
}

export default function SkillEditorPage({ skillId, active, mode, onModeChange, onBack }: PageProps) {
  const { skills, folders, versions } = useSkillState()
  const skill = skills.find((s) => s.id === skillId)
  const [files, setFiles] = useState<SkillFile[]>(skill?.files ?? [])
  const [dirs, setDirs] = useState<string[]>(skill?.dirs ?? [])
  const [draftDisplayName, setDraftDisplayName] = useState(skill?.displayName ?? '')
  const [draftFolderId, setDraftFolderId] = useState<string | null>(skill?.folderId ?? null)
  const [draftOwner, setDraftOwner] = useState(skill?.owner ?? '')
  const [activePath, setActivePath] = useState(SKILL_MD)
  const [selectedDir, setSelectedDir] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<number | null>(null)
  // data URLs for freshly uploaded images, so they display before the file list re-renders
  const assetCache = useRef(new Map<string, string>())
  const [dialog, setDialog] = useState<PathDialog>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)

  const skillVersions = useMemo(() => versions.filter((v) => v.skillId === skillId), [versions, skillId])
  const currentVersion = skillVersions.find((v) => v.version === skill?.currentVersion)
  const historyVersion = skillVersions.find((v) => v.version === viewingVersion)
  const viewingOnline = historyVersion?.version === skill?.currentVersion
  const workspaceFiles = historyVersion?.files ?? files
  const workspaceDirs = historyVersion?.dirs ?? dirs
  const editable = mode === 'edit' && !historyVersion

  const dirty = useMemo(() => !!skill && (JSON.stringify(files) !== JSON.stringify(skill.files) || JSON.stringify([...dirs].sort()) !== JSON.stringify([...skill.dirs].sort()) || draftDisplayName !== skill.displayName || draftFolderId !== skill.folderId || draftOwner !== skill.owner), [files, dirs, skill, draftDisplayName, draftFolderId, draftOwner])
  const dirtyPaths = useMemo(() => {
    const set = new Set<string>()
    for (const f of files) {
      const o = skill?.files.find((x) => x.path === f.path)
      if (!o || o.content !== f.content) set.add(f.path)
    }
    return set
  }, [files, skill])
  const visibleDirtyPaths = historyVersion ? new Set<string>() : dirtyPaths

  useEffect(() => {
    setEditorDirty(skillId, dirty)
  }, [skillId, dirty])
  useEffect(() => () => void setEditorDirty(skillId, false), [skillId])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // pick up external changes (e.g. attribute edits from the list) when there is no local draft
  const lastSynced = useRef(skill?.updatedAt)
  useEffect(() => {
    if (!skill || skill.updatedAt === lastSynced.current) return
    lastSynced.current = skill.updatedAt
    if (!dirty) {
      setFiles(skill.files)
      setDirs(skill.dirs)
      setDraftDisplayName(skill.displayName)
      setDraftFolderId(skill.folderId)
      setDraftOwner(skill.owner)
    }
  }, [skill, dirty])

  const otherNames = useMemo(() => skills.filter((s) => s.id !== skillId).map((s) => s.name), [skills, skillId])
  const checks = useMemo(() => validateSkill(files, dirs, otherNames), [files, dirs, otherNames])
  const errors = checks.filter((c) => c.level === 'error').length

  const tree = useMemo(() => buildTree(workspaceFiles, workspaceDirs), [workspaceFiles, workspaceDirs])
  const md = workspaceFiles.find((f) => f.path === SKILL_MD)
  const fm = useMemo(() => parseFrontmatter(md?.content ?? ''), [md?.content])
  const draftName = typeof fm.data.name === 'string' && fm.data.name ? fm.data.name : (historyVersion?.name ?? skill?.name ?? '')
  const draftDesc = typeof fm.data.description === 'string' ? fm.data.description : (historyVersion?.description ?? skill?.description ?? '')
  const current = workspaceFiles.find((f) => f.path === activePath) ?? md
  const publishable = !currentVersion || draftName !== currentVersion.name || draftDesc !== currentVersion.description || draftDisplayName !== currentVersion.displayName || draftFolderId !== currentVersion.folderId || draftOwner !== currentVersion.owner || JSON.stringify(files) !== JSON.stringify(currentVersion.files) || JSON.stringify([...dirs].sort()) !== JSON.stringify([...currentVersion.dirs].sort())
  const allPaths = useMemo(() => new Set([...files.map((f) => f.path), ...dirs, ...files.flatMap((f) => f.path.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/')))]), [files, dirs])

  const save = useCallback(() => {
    if (!skill) return
    if (draftName !== skill.name) {
      toast(`技能名称不可修改，请恢复为 ${skill.name}`, 'error')
      return
    }
    if (errors) {
      const details = checks.filter((c) => c.level === 'error').slice(0, 3).map((c) => `${c.label}${c.detail ? `：${c.detail}` : ''}`).join('；')
      toast(`保存失败：${details}`, 'error')
      return
    }
    saveSkillFiles(skill.id, files, dirs, { displayName: draftDisplayName, folderId: draftFolderId, owner: draftOwner })
    lastSynced.current = undefined
    toast('保存成功')
  }, [skill, errors, checks, files, dirs, draftName, draftDisplayName, draftFolderId, draftOwner])

  const publish = useCallback(() => {
    if (!skill || !publishable) return
    if (draftName !== skill.name) {
      toast(`技能名称不可修改，请恢复为 ${skill.name}`, 'error')
      return
    }
    if (errors) {
      const details = checks.filter((c) => c.level === 'error').slice(0, 3).map((c) => `${c.label}${c.detail ? `：${c.detail}` : ''}`).join('；')
      toast(`发布失败：${details}`, 'error')
      return
    }
    const version = publishSkill(skill.id, files, dirs, { displayName: draftDisplayName, folderId: draftFolderId, owner: draftOwner })
    if (!version) return
    lastSynced.current = undefined
    onModeChange('view')
    toast(`发布成功，当前线上版本为 v${version.version}`)
  }, [skill, errors, checks, files, dirs, publishable, draftName, draftDisplayName, draftFolderId, draftOwner, onModeChange])

  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (editable && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      } else if (e.key === '/' && extOf(activePath) === 'md') {
        e.preventDefault()
        setSourceMode((v) => !v)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [active, editable, save, activePath])

  const infoSkill = useMemo(() => (skill ? { ...skill, name: draftName, displayName: draftDisplayName, description: draftDesc, folderId: draftFolderId, owner: draftOwner } : null), [skill, draftName, draftDesc, draftDisplayName, draftFolderId, draftOwner])

  if (!skill) return <div className="h-full flex items-center justify-center text-muted">技能不存在或已被删除</div>

  const updateFile = (path: string, content: string) => setFiles((fs) => fs.map((f) => (f.path === path ? { ...f, content } : f)))

  /** Show images referenced by Markdown files using the skill's own assets. */
  const resolveAssetUrl = (fromDir: string) => (url: string) => {
    const path = resolveRelative(fromDir, url)
    if (path && assetCache.current.has(path)) return assetCache.current.get(path)!
    const f = path ? workspaceFiles.find((x) => x.path === path) : undefined
    if (!f) return url
    const ext = extOf(f.path)
    if (f.encoding === 'base64') return `data:${MIME[ext] ?? 'application/octet-stream'};base64,${f.content}`
    if (ext === 'svg') return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(f.content)}`
    return url
  }

  /** Images pasted or uploaded into the editor are stored under assets/ and referenced relatively. */
  const uploadAsset = (fromDir: string) => async (file: File) => {
    const read = await readUploadedFile(file)
    const dot = read.path.lastIndexOf('.')
    const stem = dot > 0 ? read.path.slice(0, dot) : read.path
    const ext = dot > 0 ? read.path.slice(dot) : ''
    let path = `assets/${read.path}`
    for (let i = 1; files.some((f) => f.path === path); i++) path = `assets/${stem}-${i}${ext}`
    const mime = read.encoding === 'base64' ? (MIME[extOf(path)] ?? 'application/octet-stream') : 'image/svg+xml'
    assetCache.current.set(path, read.encoding === 'base64' ? `data:${mime};base64,${read.content}` : `data:${mime};charset=utf-8,${encodeURIComponent(read.content)}`)
    setFiles((fs) => [...fs, { ...read, path }])
    return encodeURI(relativePath(fromDir, path))
  }

  const createEntry = (kind: 'file' | 'dir', path: string) => {
    const err = checkPath(path)
    if (err) return err
    if (allPaths.has(path)) return '该路径已存在'
    const parents = path.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'))
    if (parents.some((p) => files.some((f) => f.path === p))) return '上级路径与已有文件冲突'
    if (kind === 'dir') {
      setDirs((d) => [...d, path])
      setSelectedDir(path)
    } else {
      setFiles((fs) => [...fs, { path, content: templateForFile(path), encoding: 'utf8' }])
      setActivePath(path)
    }
    setDialog(null)
    return null
  }

  const renameEntry = (node: TNode, next: string) => {
    const err = checkPath(next)
    if (err) return err
    if (next === node.path) {
      setDialog(null)
      return null
    }
    if (next === SKILL_MD) return '不能使用 SKILL.md 作为文件名'
    if (allPaths.has(next)) return '该路径已存在'
    if (node.type === 'dir' && next.startsWith(node.path + '/')) return '不能移动到自身子目录下'
    const move = (p: string) => (p === node.path ? next : node.type === 'dir' && p.startsWith(node.path + '/') ? next + p.slice(node.path.length) : p)
    setFiles((fs) => fs.map((f) => ({ ...f, path: move(f.path) })))
    setDirs((ds) => ds.map(move))
    setActivePath((a) => move(a))
    setSelectedDir((d) => (d ? move(d) : d))
    setDialog(null)
    return null
  }

  const removeEntry = async (node: TNode) => {
    const inside = node.type === 'dir' ? files.filter((f) => f.path.startsWith(node.path + '/')).length : 0
    const ok = await confirmDialog({
      title: node.type === 'dir' ? '删除目录' : '删除文件',
      content: node.type === 'dir' ? `确定删除目录 ${node.path}/ 吗？${inside ? `其中的 ${inside} 个文件将一并删除。` : ''}` : `确定删除文件 ${node.path} 吗？`,
      okText: '删除',
      danger: true,
    })
    if (!ok) return
    const gone = (p: string) => p === node.path || p.startsWith(node.path + '/')
    setFiles((fs) => fs.filter((f) => !gone(f.path)))
    setDirs((ds) => ds.filter((d) => !gone(d)))
    if (gone(activePath)) setActivePath(SKILL_MD)
    if (selectedDir !== null && gone(selectedDir)) setSelectedDir(null)
  }

  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    const selected = Array.from(list)
    if (selected.length > 20) {
      toast('单次最多上传 20 个文件', 'error')
      return
    }
    const tooLarge = selected.filter((f) => f.size > 5 * 1024 * 1024)
    if (tooLarge.length) {
      toast(`文件不能超过 5 MB：${tooLarge.map((f) => f.name).join('、')}`, 'error')
      return
    }
    let read
    try {
      read = await Promise.all(selected.map(readUploadedFile))
    } catch {
      toast('文件读取失败，请检查文件后重试', 'error')
      return
    }
    let replaced = 0
    let next = [...files]
    for (const f of read) {
      const path = selectedDir ? `${selectedDir}/${f.path}` : f.path
      if (path === SKILL_MD && f.encoding !== 'utf8') continue
      if (next.some((x) => x.path === path)) {
        replaced++
        next = next.map((x) => (x.path === path ? { ...f, path } : x))
      } else next.push({ ...f, path })
    }
    if (replaced) {
      const ok = await confirmDialog({ title: '覆盖同名文件？', content: `当前目录存在 ${replaced} 个同名文件，上传后将覆盖其内容。是否继续？`, okText: '覆盖', danger: true })
      if (!ok) return
    }
    setFiles(next)
    const last = read[read.length - 1]
    setActivePath(selectedDir ? `${selectedDir}/${last.path}` : last.path)
    toast(`已上传 ${read.length} 个文件${replaced ? `（覆盖 ${replaced} 个）` : ''}，保存后生效`)
  }

  const leave = async () => {
    if (editable) {
      const ok = await confirmDialog({ title: '离开编辑页面？', content: '当前技能正在编辑，返回列表后草稿仍会保留。是否返回？', okText: '返回列表' })
      if (!ok) return
    }
    setViewingVersion(null)
    setVersionsOpen(false)
    onBack()
  }

  const exitEdit = async () => {
    if (dirty) {
      const ok = await confirmDialog({ title: '放弃未保存的修改？', content: '退出编辑后，当前未保存的文件修改将被丢弃。', okText: '放弃修改', danger: true })
      if (!ok) return
      setFiles(skill.files)
      setDirs(skill.dirs)
      setDraftDisplayName(skill.displayName)
      setDraftFolderId(skill.folderId)
      setDraftOwner(skill.owner)
    }
    onModeChange('view')
  }

  const resetDraft = async () => {
    if (!currentVersion) return
    const ok = await confirmDialog({ title: '重置草稿？', content: '把当前草稿重置为线上版本', okText: '重置', danger: true })
    if (!ok) return
    setFiles(currentVersion.files)
    setDirs(currentVersion.dirs)
    setDraftDisplayName(currentVersion.displayName)
    setDraftFolderId(currentVersion.folderId)
    setDraftOwner(currentVersion.owner)
    saveSkillFiles(skill.id, currentVersion.files, currentVersion.dirs, { displayName: currentVersion.displayName, folderId: currentVersion.folderId, owner: currentVersion.owner })
    lastSynced.current = undefined
    setActivePath(SKILL_MD)
    setSelectedDir(null)
    toast('草稿已重置为线上版本')
  }

  const isMd = current && extOf(current.path) === 'md'
  const richMd = isMd && !sourceMode
  const currentDir = current ? current.path.split('/').slice(0, -1).join('/') : ''
  const totalSize = workspaceFiles.reduce((n, f) => n + fileSize(f), 0)

  return (
    <div className="h-full flex flex-col px-3 pb-3">
      {/* header */}
      <div className="shrink-0 flex items-center gap-4 pr-4 py-3 bg-white">
        <button onClick={leave} className="size-8 rounded-[3px] border border-line flex items-center justify-center text-muted hover:text-brand hover:border-brand cursor-pointer" aria-label="返回列表">
          <ArrowLeft size={15} />
        </button>
        <div className="size-9 rounded-[6px] bg-accent-soft flex items-center justify-center">
          <Puzzle size={18} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-ink truncate">{historyVersion?.displayName || draftDisplayName || draftName}</span>
            {historyVersion && <span className="shrink-0 font-mono text-[12px] text-muted">v{historyVersion.version}</span>}
            <span className={cx('shrink-0 px-1.5 h-[20px] leading-[20px] rounded-[2px] text-[11px]', historyVersion ? (viewingOnline ? 'bg-[#E8F7EE] text-[#12A150]' : 'bg-canvas text-muted') : 'bg-accent-soft text-accent')}>
              {historyVersion ? (viewingOnline ? '线上版本' : '历史版本') : '草稿版本'}
            </span>
            {!historyVersion && publishable && <span className="shrink-0 px-1.5 h-[20px] leading-[20px] rounded-[2px] text-[11px] bg-[#FFF4E5] text-[#D97706]">有修改</span>}
            {editable &&
              (dirty ? (
                <span className="px-1.5 h-[18px] leading-[18px] rounded-[2px] text-[11px] bg-accent-soft text-accent">未保存</span>
              ) : (
                <span className="px-1.5 h-[18px] leading-[18px] rounded-[2px] text-[11px] bg-[#E8F7EE] text-[#12A150]">已保存</span>
              ))}
            {historyVersion && (
              <>
                <span className="h-3 w-px bg-line mx-3" aria-hidden />
                <div className="group/info relative flex items-center gap-1 text-[11px] text-faint">
                  <span>发布时间：{formatTime(historyVersion.publishedAt)}</span>
                  <button type="button" aria-label="查看版本与修改信息" className="flex items-center cursor-default hover:text-brand">
                    <Info size={13} />
                  </button>
                  <div className="absolute left-0 top-full z-30 hidden pt-2 group-hover/info:block group-focus-within/info:block">
                    <div className="w-[240px] rounded-[4px] border border-line bg-white p-3 shadow-lg grid grid-cols-[64px_1fr] gap-y-1.5 text-[12px] leading-5 text-ink">
                      <span className="text-muted">发布人：</span><span>{userLabel(historyVersion.publishedBy)}</span>
                      <span className="text-muted">负责人：</span><span>{userLabel(historyVersion.owner)}</span>
                      <span className="text-muted">创建人：</span><span>{userLabel(skill.owner)}</span>
                      <span className="text-muted">创建时间：</span><span>{formatTime(skill.createdAt)}</span>
                      <span className="text-muted">修改人：</span><span>{userLabel(historyVersion.updatedBy)}</span>
                      <span className="text-muted">修改时间：</span><span>{formatTime(historyVersion.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="text-[13px] text-muted truncate mt-0.5" title={draftDesc}>
            {draftDesc || <span className="text-faint">暂无描述</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editable ? (
            currentVersion && (
              <Button variant="ghost" disabled={!publishable} onClick={resetDraft}>
                重置草稿
              </Button>
            )
          ) : (
            <Button variant="ghost" onClick={() => setVersionsOpen(true)}>
              版本记录
            </Button>
          )}
          {editable && (
            <Button variant="ghost" icon={<Settings2 size={13} />} onClick={() => setInfoOpen(true)}>
              基本信息
            </Button>
          )}
          {!editable && (
            <Button variant="ghost" icon={<Download size={13} />} onClick={() => exportSkills([{ name: draftName, files: workspaceFiles, dirs: workspaceDirs, version: historyVersion?.version }]).then(() => toast('导出成功'))}>
              导出
            </Button>
          )}
          {historyVersion ? (
            <Button variant="primary" onClick={() => setViewingVersion(null)}>
              返回草稿版本
            </Button>
          ) : editable ? (
            <>
              <Button variant="ghost" onClick={exitEdit}>
                退出编辑
              </Button>
              <Button icon={<Save size={13} />} disabled={!dirty} onClick={save} title="Ctrl / ⌘ + S">
                保存
              </Button>
              <Button variant="primary" icon={<Send size={13} />} disabled={!publishable} onClick={publish}>
                发布
              </Button>
            </>
          ) : (
            <Button variant="primary" icon={<PencilLine size={13} />} onClick={() => onModeChange('edit')}>
              编辑
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        {/* file tree */}
        <div className="w-[240px] shrink-0 border border-line rounded-[4px] flex flex-col bg-white">
          <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-line">
            <span className="text-[14px] font-medium">技能文件</span>
            <span className={cx('items-center gap-2.5 text-muted', editable ? 'flex' : 'hidden')}>
              <button title="新建文件" className="hover:text-brand cursor-pointer" onClick={() => setDialog({ kind: 'file', base: selectedDir ?? '' })}>
                <FilePlus2 size={15} />
              </button>
              <button title="新建文件夹" className="hover:text-brand cursor-pointer" onClick={() => setDialog({ kind: 'dir', base: selectedDir ?? '' })}>
                <FolderPlus size={15} />
              </button>
              <button title="上传文件到当前目录" className="hover:text-brand cursor-pointer" onClick={() => uploadRef.current?.click()}>
                <Upload size={15} />
              </button>
              <input
                ref={uploadRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  upload(e.target.files)
                  e.target.value = ''
                }}
              />
            </span>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <FileTree
              nodes={tree}
              rootName={draftName}
              activePath={current?.path ?? ''}
              dirtyPaths={visibleDirtyPaths}
              readOnly={!editable}
              onOpenFile={(p) => {
                setActivePath(p)
                setSelectedDir(p.split('/').slice(0, -1).join('/'))
              }}
              onNewFile={(dir) => setDialog({ kind: 'file', base: dir })}
              onUpload={(dir) => {
                setSelectedDir(dir)
                uploadRef.current?.click()
              }}
              onRename={(node) => setDialog({ kind: 'rename', node })}
              onDelete={removeEntry}
              onDownload={(p) => {
                const f = workspaceFiles.find((x) => x.path === p)
                if (f) downloadFile(f)
              }}
            />
          </div>
          <div className="shrink-0 border-t border-line px-3 py-2 text-[11px] text-faint flex justify-between">
            <span>{workspaceFiles.length} 个文件</span>
            <span>{formatBytes(totalSize)}</span>
          </div>
        </div>

        {/* editor */}
        <div className="flex-1 min-w-0 border border-line rounded-[4px] flex flex-col bg-white overflow-hidden">
          {current && (
            <>
              <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-line">
                {fileIcon(current.path)}
                <span className="font-mono text-[13px] text-ink truncate">
                  <span className="text-faint">{draftName}/</span>
                  {current.path}
                </span>
                {visibleDirtyPaths.has(current.path) && <span className="size-1.5 rounded-full bg-accent" title="未保存" />}
                <span className="text-[11px] text-faint ml-1">
                  {current.encoding === 'utf8' ? `${current.content.split('\n').length} 行 · ` : '二进制 · '}
                  {formatBytes(fileSize(current))}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {isMd && editable && !sourceMode && <ShortcutHelp />}
                  {isMd && (
                    <button
                      title="切换源码模式 (Ctrl+/)"
                      aria-pressed={sourceMode}
                      onClick={() => setSourceMode((v) => !v)}
                      className={cx('h-7 px-2 flex items-center gap-1 rounded-[3px] text-[13px] cursor-pointer transition-colors', sourceMode ? 'bg-brand/10 text-brand' : 'text-muted hover:text-brand hover:bg-canvas')}
                    >
                      <Code2 size={14} />
                      源码
                    </button>
                  )}
                  <button title="下载文件" className="size-7 flex items-center justify-center rounded-[3px] text-muted hover:text-brand hover:bg-canvas cursor-pointer" onClick={() => downloadFile(current)}>
                    <Download size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 flex">
                {current.encoding === 'base64' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-canvas text-muted">
                    {IMAGE_EXT.includes(extOf(current.path)) ? (
                      <img src={`data:${MIME[extOf(current.path)]};base64,${current.content}`} alt={current.path} className="max-w-[80%] max-h-[70%] object-contain rounded-[4px] border border-line bg-white" />
                    ) : (
                      <div className="text-[14px]">二进制文件不支持在线编辑</div>
                    )}
                    <Button variant="ghost" icon={<Download size={13} />} onClick={() => downloadFile(current)}>
                      下载文件
                    </Button>
                  </div>
                ) : richMd ? (
                  <div className="flex-1 min-w-0">
                    <Suspense fallback={<div className="h-full flex items-center justify-center text-[13px] text-faint">编辑器加载中…</div>}>
                      <MarkdownEditor
                        key={`${historyVersion?.id ?? 'draft'}:${current.path}`}
                        value={current.content}
                        readOnly={!editable}
                        onChange={(c) => updateFile(current.path, c)}
                        resolveUrl={resolveAssetUrl(currentDir)}
                        uploadImage={uploadAsset(currentDir)}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <CodeEditor
                      key={`${historyVersion?.id ?? 'draft'}:${current.path}`}
                      value={isMd ? splitFrontmatter(current.content).body : current.content}
                      onChange={(c) => {
                        if (isMd) {
                          const { yaml } = splitFrontmatter(current.content)
                          updateFile(current.path, joinFrontmatter(yaml, c))
                        } else updateFile(current.path, c)
                      }}
                      readOnly={!editable}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      <PathModal
        open={!!dialog}
        title={dialog?.kind === 'dir' ? '新建文件夹' : dialog?.kind === 'rename' ? `重命名${dialog.node.type === 'dir' ? '目录' : '文件'}` : '新建文件'}
        label={dialog?.kind === 'dir' ? '文件夹路径' : dialog?.kind === 'rename' ? `${dialog.node.type === 'dir' ? '目录' : '文件'}名称` : '文件路径'}
        hint={dialog?.kind === 'rename' ? '仅修改名称，所在目录保持不变' : '相对技能根目录，例如 scripts/run.py、references/GUIDE.md'}
        prefix={dialog?.kind === 'rename' ? undefined : dialog?.base ? `${dialog.base}/` : ''}
        initial={dialog?.kind === 'rename' ? dialog.node.name : ''}
        onClose={() => setDialog(null)}
        onSubmit={(v) => {
          if (dialog?.kind === 'rename') {
            if (!v) return '请输入名称'
            if (v.includes('/')) return '名称不能包含 /'
            const parent = dialog.node.path.split('/').slice(0, -1).join('/')
            return renameEntry(dialog.node, parent ? `${parent}/${v}` : v)
          }
          return createEntry(dialog?.kind === 'dir' ? 'dir' : 'file', v)
        }}
      />
      <SkillFormModal
        open={infoOpen}
        mode="edit"
        skill={infoSkill}
        folders={folders}
        existingNames={otherNames}
        defaultFolderId={null}
        onClose={() => setInfoOpen(false)}
        onSubmit={(input) => {
          setInfoOpen(false)
          setFiles((fs) => fs.map((f) => (f.path === SKILL_MD ? { ...f, content: setFrontmatterFields(f.content, { name: skill.name, description: input.description }) } : f)))
          setDraftDisplayName(input.displayName)
          setDraftFolderId(input.folderId)
          setDraftOwner(input.owner)
          toast('基本信息已更新，发布后生效')
        }}
      />
      <VersionDrawer
        open={versionsOpen}
        skillName={skill.name}
        versions={skillVersions}
        currentVersion={skill.currentVersion}
        onClose={() => setVersionsOpen(false)}
        onView={(version) => {
          setViewingVersion(version.version)
          setVersionsOpen(false)
        }}
      />
    </div>
  )
}
