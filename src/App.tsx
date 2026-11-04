import { useEffect, useState } from 'react'
import { Header, Sidebar, TabsBar, menuLabel } from './components/layout'
import { Overlays, confirmDialog } from './components/ui'
import ApiInfoPage from './pages/ApiInfoPage'
import PlaceholderPage from './pages/PlaceholderPage'
import SkillLibraryPage, { type SkillPageMode } from './features/skills/SkillLibraryPage'
import SkillEditorPage from './features/skills/SkillEditorPage'
import { isEditorDirty, setEditorDirty, useSkillState } from './features/skills/store'

export default function App() {
  const { skills } = useSkillState()
  const [tabs, setTabs] = useState<string[]>(['api-info', 'api-param', 'skills'])
  const [active, setActive] = useState('skills')
  const [skillSessions, setSkillSessions] = useState<string[]>([])
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const [modes, setModes] = useState<Record<string, SkillPageMode>>({})

  const open = async (key: string, fromMenu = false) => {
    if ((key !== active || fromMenu) && active === 'skills' && activeSkillId && modes[activeSkillId] === 'edit') {
      const ok = await confirmDialog({ title: '离开编辑页面？', content: '当前技能正在编辑，切换页面后草稿仍会保留。是否离开？', okText: '离开' })
      if (!ok) return false
    }
    setTabs((t) => (t.includes(key) ? t : [...t, key]))
    setActive(key)
    return true
  }

  const openMenu = async (key: string) => {
    const opened = await open(key, true)
    if (opened && key === 'skills') setActiveSkillId(null)
  }

  const openSkill = (id: string, mode: SkillPageMode) => {
    setModes((m) => ({ ...m, [id]: mode === 'view' && m[id] === 'edit' && isEditorDirty(id) ? 'edit' : mode }))
    setSkillSessions((ids) => (ids.includes(id) ? ids : [...ids, id]))
    setActiveSkillId(id)
    open('skills')
  }

  const removeTab = (key: string) => {
    setTabs((t) => {
      const idx = t.indexOf(key)
      const next = t.filter((k) => k !== key)
      setActive((a) => (a === key ? (next[Math.min(idx, next.length - 1)] ?? '') : a))
      return next
    })
  }

  const close = async (key: string) => {
    const editingIds = key === 'skills' ? skillSessions.filter((id) => modes[id] === 'edit') : []
    const dirtyIds = key === 'skills' ? skillSessions.filter(isEditorDirty) : []
    if (editingIds.length) {
      const hasDirty = dirtyIds.length > 0
      const ok = await confirmDialog({
        title: hasDirty ? '放弃未保存的修改？' : '关闭编辑页面？',
        content: hasDirty ? '技能库中存在未保存的文件修改，关闭后修改将丢失。' : '技能库中存在正在编辑的技能，关闭页签将结束当前编辑。是否关闭？',
        okText: hasDirty ? '放弃并关闭' : '关闭页签',
        danger: hasDirty,
      })
      if (!ok) return
      dirtyIds.forEach((id) => setEditorDirty(id, false))
    }
    if (key === 'skills') {
      setSkillSessions([])
      setActiveSkillId(null)
    }
    removeTab(key)
  }

  useEffect(() => {
    setSkillSessions((ids) => {
      const next = ids.filter((id) => skills.some((s) => s.id === id))
      return next.length === ids.length ? ids : next
    })
    if (activeSkillId && !skills.some((s) => s.id === activeSkillId)) setActiveSkillId(null)
  }, [skills, activeSkillId])

  const info = (key: string) => ({ title: menuLabel(key).label })

  const render = (key: string) => {
    if (key === 'api-info') return <ApiInfoPage />
    if (key === 'skills') {
      return (
        <>
          <div className={activeSkillId ? 'hidden' : 'h-full'}>
            <SkillLibraryPage onOpenSkill={openSkill} />
          </div>
          {skillSessions.map((id) => (
            <div key={id} className={activeSkillId === id ? 'h-full' : 'hidden'}>
              <SkillEditorPage skillId={id} active={active === 'skills' && activeSkillId === id} isOpen={activeSkillId === id} mode={modes[id] ?? 'view'} onModeChange={(m) => setModes((x) => ({ ...x, [id]: m }))} onBack={() => setActiveSkillId(null)} />
            </div>
          ))}
        </>
      )
    }
    return <PlaceholderPage title={menuLabel(key).label} />
  }

  const sideActive = active

  return (
    <div className="h-full flex flex-col bg-white min-w-[1200px]">
      <Header />
      <div className="flex-1 flex min-h-0">
        <Sidebar active={sideActive} onSelect={openMenu} />
        <main className="flex-1 min-w-0 flex flex-col">
          <TabsBar tabs={tabs.map((k) => ({ key: k, title: info(k).title }))} active={active} onSelect={open} onClose={close} />
          {tabs.map((k) => (
            <div key={k} className={k === active ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
              <div className="flex-1 min-h-0">{render(k)}</div>
            </div>
          ))}
          {!tabs.length && <PlaceholderPage title="请从左侧菜单选择功能" />}
        </main>
      </div>
      <Overlays />
    </div>
  )
}
