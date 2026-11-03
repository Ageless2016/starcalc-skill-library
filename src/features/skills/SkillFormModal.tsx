import { useEffect, useMemo, useState } from 'react'
import { Button, Combobox, Field, Modal, TextInput, cx, type ComboOption } from '../../components/ui'
import type { Folder, Skill } from './types'
import { DESC_MAX, NAME_MAX, STANDARD_DIRS, validateDescription, validateName } from './spec'
import { flattenFolders } from './folders'
import { USERS, userLabel } from './users'
import { folderPath, type SkillInput } from './store'

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  skill?: Skill | null
  folders: Folder[]
  existingNames: string[]
  defaultFolderId: string | null
  onClose: () => void
  onSubmit: (input: SkillInput) => void
}

export function FolderOptions({ folders }: { folders: Folder[] }) {
  return (
    <>
      {flattenFolders(folders).map(({ folder, depth }) => (
        <option key={folder.id} value={folder.id}>
          {'\u3000'.repeat(depth)}
          {folder.name}
        </option>
      ))}
    </>
  )
}

export default function SkillFormModal({ open, mode, skill, folders, existingNames, defaultFolderId, onClose, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [desc, setDesc] = useState('')
  const [folderId, setFolderId] = useState<string>('')
  const [owner, setOwner] = useState('')
  const [dirs, setDirs] = useState<string[]>(['scripts', 'references', 'assets'])
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(skill?.name ?? '')
    setDisplayName(skill?.displayName ?? skill?.name ?? '')
    setDesc(skill?.description ?? '')
    setFolderId(skill ? (skill.folderId ?? '') : (defaultFolderId ?? ''))
    setOwner(skill?.owner ?? '')
    setDirs(['scripts', 'references', 'assets'])
    setTouched(false)
  }, [open, skill, defaultFolderId, folders])

  const nameErr = validateName(name) ?? (existingNames.includes(name) ? '技能名称已存在' : null)
  const descErr = validateDescription(desc)
  const ownerErr = owner ? null : '请选择负责人'
  const showNameErr = touched || !!name

  const folderOptions = useMemo<ComboOption[]>(
    () => flattenFolders(folders).map(({ folder, depth }) => ({ value: folder.id, label: folderPath(folders, folder.id), short: folder.name, depth })),
    [folders],
  )
  const ownerOptions = useMemo<ComboOption[]>(() => USERS.map((u) => ({ value: u.id, label: userLabel(u.id), keywords: `${u.id} ${u.name}` })), [])

  const submit = () => {
    setTouched(true)
    if (nameErr || descErr || ownerErr) return
    onSubmit({ name, displayName: displayName.trim() || name, description: desc.trim(), folderId: folderId || null, owner, dirs: mode === 'create' ? dirs : undefined })
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '新增技能' : '编辑技能属性'}
      width={600}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={submit}>
            {mode === 'create' ? '下一步：编辑技能文件' : '保存'}
          </Button>
        </>
      }
    >
      {mode === 'create' && (
        <div className="flex items-center gap-0 mb-5 text-[13px]">
          <div className="flex items-center gap-2 text-brand font-medium">
            <span className="size-5 rounded-full bg-brand text-white text-[11px] flex items-center justify-center">1</span>
            填写基本信息
          </div>
          <div className="flex-1 h-px bg-line mx-3" />
          <div className="flex items-center gap-2 text-muted">
            <span className="size-5 rounded-full border border-line text-[11px] flex items-center justify-center">2</span>
            管理技能文件
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Field label="技能名称" required error={showNameErr ? nameErr : null}>
          <TextInput
            autoFocus={mode === 'create'}
            disabled={mode === 'edit'}
            value={name}
            maxLength={NAME_MAX}
            placeholder={`小写字母、数字和短横线，最长${NAME_MAX}位字符`}
            className={cx(name && 'font-mono', showNameErr && nameErr && '!border-[#E5484D]')}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="显示名称">
          <TextInput value={displayName} maxLength={NAME_MAX} placeholder="用于界面展示，默认同技能名称" onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="技能描述" required error={touched ? descErr : null}>
          <div className="relative">
            <textarea
              value={desc}
              maxLength={DESC_MAX}
              rows={4}
              placeholder="说明技能做什么、何时使用，Agent 依据描述判断是否调用该技能，例如：从 PDF 文件中提取文本和表格。当用户处理 PDF 文件或提到文档提取时使用。"
              onChange={(e) => setDesc(e.target.value)}
              className={cx(
                'w-full rounded-[3px] border px-2.5 pt-2 pb-5 text-[13px] leading-5 outline-none resize-none placeholder:text-faint',
                touched && descErr ? 'border-[#E5484D]' : 'border-line focus:border-brand',
              )}
            />
            <span className="absolute right-2 bottom-2 text-[11px] text-faint">
              {desc.length}/{DESC_MAX}
            </span>
          </div>
        </Field>
        <Field label="所属目录">
          <Combobox value={folderId} onChange={setFolderId} options={folderOptions} placeholder="请选择所属目录，可输入关键字搜索" emptyText="未找到匹配的目录" />
        </Field>
        <Field label="负责人" required error={touched ? ownerErr : null}>
          <Combobox
            value={owner}
            onChange={setOwner}
            options={ownerOptions}
            placeholder="请选择负责人，可输入账号或姓名搜索"
            emptyText="未找到匹配的人员"
            invalid={touched && !!ownerErr}
          />
        </Field>
        {mode === 'create' && (
          <Field label="初始化目录">
            <div className="grid grid-cols-3 gap-2">
              {STANDARD_DIRS.map((d) => {
                const on = dirs.includes(d.name)
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => setDirs((s) => (on ? s.filter((x) => x !== d.name) : [...s, d.name]))}
                    className={cx('text-left rounded-[3px] border px-2.5 py-2 transition-colors cursor-pointer', on ? 'border-brand bg-[#F1F5FC]' : 'border-line hover:border-[#C9CDD4]')}
                  >
                    <div className={cx('font-mono text-[13px]', on ? 'text-brand' : 'text-ink')}>{d.name}/</div>
                    <div className="text-[11px] text-muted leading-4 mt-0.5 line-clamp-2">{d.desc}</div>
                  </button>
                )
              })}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  )
}
