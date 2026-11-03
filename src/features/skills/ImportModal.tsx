import { useEffect, useRef, useState } from 'react'
import { AlertCircle, FileArchive, Loader2, UploadCloud, X } from 'lucide-react'
import { Button, Field, Modal, Select, confirmDialog, cx, toast } from '../../components/ui'
import type { Folder, ParsedSkill, Skill } from './types'
import { parseImportFiles } from './zip'
import { validateDescription, validateName } from './spec'
import { FolderOptions } from './SkillFormModal'
import { CURRENT_USER, USERS, userLabel } from './users'
import { importSkills, isEditorDirty } from './store'

const MAX_IMPORT_FILES = 20
const MAX_IMPORT_SIZE = 10 * 1024 * 1024

interface Props {
  open: boolean
  folders: Folder[]
  skills: Skill[]
  defaultFolderId: string | null
  onClose: () => void
}

export default function ImportModal({ open, folders, skills, defaultFolderId, onClose }: Props) {
  const [items, setItems] = useState<ParsedSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [drag, setDrag] = useState(false)
  const [folderId, setFolderId] = useState('')
  const [owner, setOwner] = useState(CURRENT_USER.id)
  const [batchAction, setBatchAction] = useState<'skip' | 'overwrite'>('skip')
  const [overrides, setOverrides] = useState<Record<number, 'skip' | 'overwrite'>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setItems([])
    setFolderId(defaultFolderId ?? '')
    setOwner(CURRENT_USER.id)
    setBatchAction('skip')
    setOverrides({})
  }, [open, defaultFolderId])

  const handle = async (list: FileList | null) => {
    if (!list?.length) return
    const selected = Array.from(list)
    if (selected.length > MAX_IMPORT_FILES) {
      toast(`单次最多选择 ${MAX_IMPORT_FILES} 个文件`, 'error')
      return
    }
    const tooLarge = selected.filter((f) => f.size > MAX_IMPORT_SIZE)
    if (tooLarge.length) {
      toast(`单个导入文件不能超过 10 MB：${tooLarge.map((f) => f.name).join('、')}`, 'error')
      return
    }
    setLoading(true)
    try {
      const parsed = await parseImportFiles(selected)
      setItems((prev) => [...prev, ...parsed])
    } catch {
      toast('文件解析失败，请检查文件格式后重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const rows = items.map((it, idx) => {
    const err = it.error ?? validateName(it.name) ?? validateDescription(it.description)
    const dupInBatch = items.findIndex((x) => x.name === it.name) !== idx
    const existing = skills.find((s) => s.name === it.name)
    const editing = !!existing && isEditorDirty(existing.id)
    const action = existing ? (overrides[idx] ?? batchAction) : 'import'
    const canChoose = !!existing && !editing && !dupInBatch && !err
    let status: { text: string; tone: 'ok' | 'warn' | 'err' }
    if (err) status = { text: err, tone: 'err' }
    else if (dupInBatch) status = { text: '与本次导入中的技能重名，将忽略', tone: 'err' }
    else if (editing) status = { text: '正在编辑，禁止覆盖', tone: 'err' }
    else if (existing) status = { text: action === 'overwrite' ? '将覆盖' : '将跳过', tone: 'warn' }
    else status = { text: '新增', tone: 'ok' }
    return { it, existing, action, canChoose, status, valid: !err && !dupInBatch && !editing && (!existing || action === 'overwrite') }
  })
  const actionable = rows.filter((r) => r.valid)
  const replaced = actionable.filter((r) => r.existing).length
  const hasDuplicates = rows.some((r) => r.existing)
  const customized = Object.keys(overrides).length > 0

  const submit = async () => {
    if (replaced) {
      const names = actionable.filter((r) => r.existing).map((r) => r.it.name).join('、')
      const ok = await confirmDialog({
        title: `确认覆盖 ${replaced} 个技能的草稿？`,
        content: <div className="leading-6"><div className="mb-2 break-all">{names}</div><div>覆盖仅影响当前草稿，不会修改线上版本和历史版本。</div></div>,
        okText: '确认覆盖并导入',
        danger: true,
      })
      if (!ok) return
    }
    const stale = actionable.filter((r) => r.existing && skills.find((s) => s.id === r.existing!.id)?.updatedAt !== r.existing!.updatedAt)
    if (stale.length) {
      toast(`有 ${stale.length} 个技能草稿已变化，请重新预检后再导入`, 'error')
      return
    }
    const result = importSkills(actionable.map((r) => ({ ...r.it, expectedUpdatedAt: r.existing?.updatedAt })), folderId || null, owner, true)
    toast(`导入完成：新增 ${result.added} 个${result.replaced ? `，覆盖 ${result.replaced} 个` : ''}${result.conflicted ? `，${result.conflicted} 个冲突未处理` : ''}`)
    onClose()
  }

  return (
    <Modal
      open={open}
      title="导入技能"
      width={760}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" disabled={!actionable.length} onClick={submit}>
            确认导入{actionable.length ? `（${actionable.length}）` : ''}
          </Button>
        </>
      }
    >
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          handle(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={cx('rounded-[4px] border border-dashed flex flex-col items-center justify-center py-7 cursor-pointer transition-colors', drag ? 'border-brand bg-[#F1F5FC]' : 'border-[#C9CDD4] bg-canvas hover:border-brand')}
      >
        {loading ? <Loader2 size={26} className="text-brand animate-spin" /> : <UploadCloud size={28} className="text-brand" />}
        <div className="mt-2 text-[14px] text-ink">
          将文件拖拽到此处，或 <span className="text-link">点击上传</span>
        </div>
        <div className="mt-1 text-[11px] text-muted">支持多个 ZIP 文件批量上传，每个 ZIP 仅含一个技能目录（根部含 SKILL.md），或单个 SKILL.md 文件</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".zip,.skill,.md"
          className="hidden"
          onChange={(e) => {
            handle(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {rows.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-muted">
            <span>共 {rows.length} 个技能：新增 {rows.filter((r) => !r.existing).length} 个、同名 {rows.filter((r) => r.existing).length} 个</span>
            {hasDuplicates && (
              <div className="flex items-center gap-2">
                <span>同名统一处理</span>
                <Select className="w-[120px]" value={batchAction} onChange={(e) => {
                  setBatchAction(e.target.value as 'skip' | 'overwrite')
                  setOverrides({})
                }}>
                  <option value="skip">全部跳过</option>
                  <option value="overwrite">全部覆盖</option>
                </Select>
                {customized && <span className="text-brand">自定义</span>}
              </div>
            )}
          </div>
          <div className="mt-2 border border-line rounded-[4px] overflow-hidden">
            <div className="grid grid-cols-[1.2fr_1.2fr_56px_1fr_110px_28px] gap-3 px-3 h-8 items-center bg-canvas text-[13px] font-medium text-ink">
              <span>技能名称</span>
              <span>来源</span>
              <span>文件数</span>
              <span>状态</span>
              <span>处理方式</span>
              <span />
            </div>
            <div className="max-h-[200px] overflow-auto">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1.2fr_1.2fr_56px_1fr_110px_28px] gap-3 px-3 h-10 items-center border-t border-line text-[13px]">
                  <span className="font-mono truncate" title={row.it.name}>{row.it.name || '-'}</span>
                  <span className="truncate text-muted flex items-center gap-1" title={row.it.source}>
                    <FileArchive size={12} className="shrink-0" />
                    {row.it.source}
                  </span>
                  <span className="text-muted">{row.it.files.length}</span>
                  <span className={cx('truncate flex items-center gap-1', row.status.tone === 'ok' ? 'text-[#12A150]' : row.status.tone === 'warn' ? 'text-[#D97706]' : 'text-[#E5484D]')} title={row.status.text}>
                    {row.status.tone === 'err' && <AlertCircle size={12} className="shrink-0" />}
                    {row.status.text}
                  </span>
                  {row.canChoose ? (
                    <Select value={row.action} onChange={(e) => setOverrides((current) => ({ ...current, [i]: e.target.value as 'skip' | 'overwrite' }))}>
                      <option value="skip">跳过</option>
                      <option value="overwrite">覆盖</option>
                    </Select>
                  ) : (
                    <span className="text-muted">{row.action === 'import' ? '导入' : '跳过'}</span>
                  )}
                  <button aria-label="移除" className="text-faint hover:text-ink cursor-pointer" onClick={() => {
                    setItems((current) => current.filter((_, j) => j !== i))
                    setOverrides({})
                  }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mt-5 flex flex-col gap-1">
        <Field label="导入至目录">
          <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">未分类</option>
            <FolderOptions folders={folders} />
          </Select>
        </Field>
        <Field label="负责人">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            {USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {userLabel(u.id)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
