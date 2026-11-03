import { useMemo, useState } from 'react'
import { Download, Plus, Puzzle, Search, Trash2, Upload } from 'lucide-react'
import { Button, Checkbox, Dropdown, Pagination, Select, TextInput, confirmDialog, toast } from '../../components/ui'
import DirectoryTree, { UNCATEGORIZED } from './DirectoryTree'
import SkillFormModal from './SkillFormModal'
import ImportModal from './ImportModal'
import { createSkill, deleteSkills, descendantIds, folderPath, useSkillState } from './store'
import { exportSkills } from './zip'
import { USERS, userLabel } from './users'
import type { Skill } from './types'
import { formatTime } from './time'

export type SkillPageMode = 'view' | 'edit'

export default function SkillLibraryPage({ onOpenSkill }: { onOpenSkill: (id: string, mode: SkillPageMode) => void }) {
  const { folders, skills, versions } = useSkillState()
  const [folderSel, setFolderSel] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [ownerDraft, setOwnerDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState('')
  const [query, setQuery] = useState({ name: '', owner: '', status: '' })
  const [page, setPage] = useState({ p: 1, s: 10 })
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)

  const realFolder = folderSel && folderSel !== UNCATEGORIZED ? folderSel : null

  const modifiedIds = useMemo(
    () =>
      new Set(
        skills
          .filter((s) => {
            const published = versions.find((v) => v.skillId === s.id && v.version === s.currentVersion)
            if (!published) return true
            return published.name !== s.name || published.description !== s.description || JSON.stringify(published.files) !== JSON.stringify(s.files) || JSON.stringify([...published.dirs].sort()) !== JSON.stringify([...s.dirs].sort())
          })
          .map((s) => s.id),
      ),
    [skills, versions],
  )

  const filtered = useMemo(() => {
    const scope = realFolder ? new Set(descendantIds(folders, realFolder)) : null
    const q = query.name.trim().toLowerCase()
    return skills
      .filter((s) => {
        if (folderSel === UNCATEGORIZED && s.folderId && folders.some((f) => f.id === s.folderId)) return false
        if (scope && (!s.folderId || !scope.has(s.folderId))) return false
        if (q && !s.name.toLowerCase().includes(q) && !(s.displayName || s.name).toLowerCase().includes(q)) return false
        if (query.owner && s.owner !== query.owner) return false
        if (query.status === 'unpublished' && s.currentVersion) return false
        if (query.status === 'modified' && !modifiedIds.has(s.id)) return false
        if (query.status === 'published' && (!s.currentVersion || modifiedIds.has(s.id))) return false
        return true
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [skills, folders, folderSel, realFolder, query, modifiedIds])

  const pages = Math.max(1, Math.ceil(filtered.length / page.s))
  const current = Math.min(page.p, pages)
  const rows = filtered.slice((current - 1) * page.s, current * page.s)
  const selectedSkills = skills.filter((s) => selected.includes(s.id))
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id))
  const someOnPage = rows.some((r) => selected.includes(r.id))

  const search = () => {
    setQuery({ name: nameDraft, owner: ownerDraft, status: statusDraft })
    setPage((p) => ({ ...p, p: 1 }))
  }
  const reset = () => {
    setNameDraft('')
    setOwnerDraft('')
    setStatusDraft('')
    setQuery({ name: '', owner: '', status: '' })
    setPage((p) => ({ ...p, p: 1 }))
  }

  const removeOne = async (s: Skill) => {
    const ok = await confirmDialog({ title: '删除技能', content: <>确定删除技能 <b className="font-mono text-ink">{s.name}</b> 吗？其包含的 {s.files.length} 个文件将一并删除，且不可恢复。</>, okText: '删除', danger: true })
    if (!ok) return
    deleteSkills([s.id])
    setSelected((x) => x.filter((id) => id !== s.id))
    toast('技能已删除')
  }

  const removeSelected = async () => {
    const ok = await confirmDialog({ title: '批量删除技能', content: `确定删除选中的 ${selected.length} 个技能吗？删除后不可恢复。`, okText: '删除', danger: true })
    if (!ok) return
    deleteSkills(selected)
    setSelected([])
    toast(`已删除 ${selected.length} 个技能`)
  }

  const exportBatch = async () => {
    if (!selectedSkills.length) return
    await exportSkills(selectedSkills)
    toast(`已导出 ${selectedSkills.length} 个技能`)
  }

  const headCls = 'font-medium px-3 text-left whitespace-nowrap'

  return (
    <div className="h-full flex gap-3 px-3 pt-3 pb-4">
      <DirectoryTree
        folders={folders}
        skills={skills}
        selected={folderSel}
        onSelect={(id) => {
          setFolderSel(id)
          setPage((p) => ({ ...p, p: 1 }))
          setSelected([])
        }}
      />

      <section className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-4">
          <TextInput
            className="w-[260px]"
            icon={<Search size={13} />}
            placeholder="请输入技能名称"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <Select className="w-[200px]" placeholder="负责人" value={ownerDraft} onChange={(e) => setOwnerDraft(e.target.value)} onClear={() => setOwnerDraft('')}>
            {USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {userLabel(u.id)}
              </option>
            ))}
          </Select>
          <Select className="w-[160px]" placeholder="全部状态" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} onClear={() => setStatusDraft('')}>
            <option value="unpublished">未发布</option>
            <option value="modified">有未发布修改</option>
            <option value="published">已发布</option>
          </Select>
          <Button variant="primary" className="w-16" onClick={search}>
            查询
          </Button>
          <Button className="w-16" onClick={reset}>
            重置
          </Button>
        </div>

        <div className="flex items-center gap-4 mt-4 mb-2 px-2">
          <span className="text-[13px] text-muted whitespace-nowrap">
            已选择 <span className={selected.length ? 'text-brand font-medium' : 'text-ink'}>{selected.length}</span> 项
          </span>
          <Button variant="link" icon={<Plus size={13} />} onClick={() => setCreating(true)}>
            新增技能
          </Button>
          <Button variant="link" icon={<Upload size={13} />} onClick={() => setImporting(true)}>
            导入技能
          </Button>
          <Button variant="link" icon={<Download size={13} />} disabled={!selected.length} onClick={exportBatch}>
            导出技能
          </Button>
          <Button variant="link" icon={<Trash2 size={13} />} disabled={!selected.length} onClick={removeSelected}>
            删除
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-2">
          <table className="w-full min-w-[1180px] text-[13px] text-ink table-fixed">
            <colgroup>
              <col className="w-9" />
              <col className="w-12" />
              <col className="w-5" />
              <col className="w-[260px]" />
              <col />
              <col className="w-[112px]" />
              <col className="w-[150px]" />
              <col className="w-[155px]" />
              <col className="w-[100px]" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-canvas h-10">
                <th className="pl-3">
                  <Checkbox
                    checked={allOnPage}
                    indeterminate={someOnPage && !allOnPage}
                    onChange={(v) => setSelected((s) => (v ? [...new Set([...s, ...rows.map((r) => r.id)])] : s.filter((id) => !rows.some((r) => r.id === id))))}
                  />
                </th>
                <th className={headCls}>序号</th>
                <th />
                <th className={headCls}>技能名称</th>
                <th className={headCls}>技能描述</th>
                <th className={headCls}>所属目录</th>
                <th className={headCls}>负责人</th>
                <th className={headCls}>修改时间</th>
                <th className={headCls + ' !text-center'}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id} className="h-[42px] border-b border-line hover:bg-[#FAFBFC] transition-colors">
                  <td className="pl-3">
                    <Checkbox checked={selected.includes(s.id)} onChange={(v) => setSelected((x) => (v ? [...x, s.id] : x.filter((id) => id !== s.id)))} />
                  </td>
                  <td className="px-3 text-muted tabular-nums">{(current - 1) * page.s + i + 1}</td>
                  <td className="text-center">
                    {modifiedIds.has(s.id) && <span className="inline-block size-1.5 rounded-full bg-[#F59E0B]" title="有未发布的修改" />}
                  </td>
                  <td className="px-3">
                    <button onClick={() => onOpenSkill(s.id, 'view')} className="flex items-center gap-1.5 max-w-full text-ink hover:text-link cursor-pointer" title={s.name}>
                      <Puzzle size={13} className="text-accent shrink-0" />
                      <span className="min-w-0 text-left">
                        <span className="block truncate">{s.displayName || s.name}</span>
                        <span className="block truncate font-mono text-[11px] text-faint">{s.name}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 truncate text-muted" title={s.description}>
                    {s.description}
                  </td>
                  <td className="px-3 truncate" title={folderPath(folders, s.folderId) || '未分类'}>
                    {folderPath(folders, s.folderId) || <span className="text-faint">未分类</span>}
                  </td>
                  <td className="px-3 truncate">{userLabel(s.owner)}</td>
                  <td className="px-3 tabular-nums">{formatTime(s.updatedAt)}</td>
                  <td className="px-3 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-3 text-link">
                      <button className="hover:underline cursor-pointer" onClick={() => onOpenSkill(s.id, 'view')}>
                        查看
                      </button>
                      <Dropdown
                        label="更多"
                        className="hover:text-[#1546B8]"
                        items={[
                          { label: '导出', icon: <Download size={12} className="text-muted" />, onSelect: () => void exportSkills([s]).then(() => toast('导出成功')) },
                          { label: '删除', icon: <Trash2 size={12} />, danger: true, divided: true, onSelect: () => void removeOne(s) },
                        ]}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <Puzzle size={32} strokeWidth={1.2} className="text-faint" />
              <div className="mt-3 text-[14px] text-ink">暂无技能</div>
              <div className="mt-1 text-[13px]">{query.name || query.owner ? '没有符合查询条件的技能，请调整条件后重试' : '当前目录下还没有技能'}</div>
              {!query.name && !query.owner && (
                <div className="flex gap-3 mt-4">
                  <Button variant="primary" icon={<Plus size={13} />} onClick={() => setCreating(true)}>
                    新增技能
                  </Button>
                  <Button icon={<Upload size={13} />} onClick={() => setImporting(true)}>
                    导入技能
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-3 px-2">
          <Pagination total={filtered.length} page={current} pageSize={page.s} onChange={(p, s) => setPage({ p, s })} />
        </div>
      </section>

      <SkillFormModal
        open={creating}
        mode="create"
        folders={folders}
        existingNames={skills.map((s) => s.name)}
        defaultFolderId={realFolder}
        onClose={() => setCreating(false)}
        onSubmit={(input) => {
          const s = createSkill(input)
          setCreating(false)
          toast('技能已创建，请完善技能文件')
          onOpenSkill(s.id, 'edit')
        }}
      />
      <ImportModal open={importing} folders={folders} skills={skills} defaultFolderId={realFolder} onClose={() => setImporting(false)} />
    </div>
  )
}
