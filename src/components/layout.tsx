import { useState } from 'react'
import { Bell, Bot, ChevronDown, ChevronRight, Database, LayoutGrid, MessageSquareText, PanelLeftClose, PanelLeftOpen, Puzzle, UserCircle2, X, type LucideIcon } from 'lucide-react'
import { cx } from './ui'

export interface MenuItem {
  key: string
  label: string
  icon?: LucideIcon
  children?: MenuItem[]
}

export const MENU: MenuItem[] = [
  {
    key: 'knowledge',
    label: '知识库',
    icon: LayoutGrid,
    children: [
      { key: 'api-info', label: 'API接口信息' },
      { key: 'api-param', label: 'API入参枚举信息' },
      { key: 'param-enum', label: '参数枚举信息' },
      { key: 'qa', label: '问答示例库' },
    ],
  },
  { key: 'dataset', label: '数据集', icon: Database },
  { key: 'agent', label: 'Agent管理', icon: Bot },
  { key: 'prompt', label: '提示词管理', icon: MessageSquareText },
  { key: 'skills', label: '技能库', icon: Puzzle },
]

export function menuLabel(key: string): { group?: string; label: string } {
  for (const m of MENU) {
    if (m.key === key) return { label: m.label }
    const c = m.children?.find((x) => x.key === key)
    if (c) return { group: m.label, label: c.label }
  }
  return { label: key }
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF9A3D" />
          <stop offset="1" stopColor="#E8361E" />
        </linearGradient>
      </defs>
      <path d="M17 3c.8 5.6 3.4 8.4 9 9.4-5.6 1-8.2 3.8-9 9.4-.8-5.6-3.4-8.4-9-9.4 5.6-1 8.2-3.8 9-9.4Z" fill="url(#lg)" />
      <path d="M7.5 18.5c.4 2.6 1.6 3.9 4.2 4.4-2.6.5-3.8 1.8-4.2 4.4-.4-2.6-1.6-3.9-4.2-4.4 2.6-.5 3.8-1.8 4.2-4.4Z" fill="#F26B1D" />
      <circle cx="25" cy="25" r="2" fill="#1B4C9C" />
    </svg>
  )
}

const TOP_NAV = ['资源中心', '应用开发', '应用评测', '发布中心', '运营中心']

export function Header() {
  return (
    <header className="h-[50px] shrink-0 relative flex items-center px-4 bg-white border-b border-line z-20">
      <div className="flex items-center gap-2">
        <Logo />
        <span className="text-[17px] font-bold tracking-wide text-ink">星算AI</span>
        <span className="text-[17px] font-bold text-ink">|</span>
        <span className="text-[17px] font-bold text-ink font-serif">StarCalc</span>
        <span className="ml-3 text-[15px] text-ink">数据应用开发平台</span>
      </div>
      <nav className="absolute left-1/2 -translate-x-1/2 flex h-full">
        {TOP_NAV.map((n, i) => (
          <a key={n} href="#" onClick={(e) => e.preventDefault()} className={cx('relative h-full px-[26px] flex items-center text-[13px] transition-colors', i === 0 ? 'text-accent' : 'text-ink hover:text-accent')}>
            {n}
            {i === 0 && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-[54px] bg-accent rounded-full" />}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-5 text-[13px] text-ink">
        <button className="relative text-muted hover:text-ink cursor-pointer" aria-label="通知">
          <Bell size={16} />
          <span className="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-[#F04438] text-white text-[8px] leading-3 text-center">1</span>
        </button>
        <button className="flex items-center gap-1.5 cursor-pointer">
          <UserCircle2 size={17} className="text-faint" />
          A80531
          <ChevronDown size={13} className="text-muted" />
        </button>
      </div>
    </header>
  )
}

export function Sidebar({ active, onSelect }: { active: string; onSelect: (key: string) => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ knowledge: true })
  return (
    <aside className={cx('shrink-0 flex flex-col bg-white border-r border-line transition-[width] duration-200', collapsed ? 'w-[52px]' : 'w-[152px]')}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {MENU.map((m) => {
          const Icon = m.icon!
          const hasChildren = !!m.children?.length
          const childActive = m.children?.some((c) => c.key === active)
          const selfActive = m.key === active
          const open = expanded[m.key] && !collapsed
          return (
            <div key={m.key}>
              <button
                title={collapsed ? m.label : undefined}
                onClick={() => (hasChildren ? (collapsed ? onSelect(m.children![0].key) : setExpanded((e) => ({ ...e, [m.key]: !e[m.key] }))) : onSelect(m.key))}
                className={cx(
                  'relative w-full h-12 flex items-center gap-2.5 text-[13px] cursor-pointer transition-colors',
                  collapsed ? 'justify-center' : 'pl-[18px] pr-3',
                  selfActive ? 'bg-accent-soft text-accent' : childActive ? 'text-accent' : 'text-ink hover:text-accent',
                )}
              >
                <Icon size={15} strokeWidth={1.6} className="shrink-0" />
                {!collapsed && <span className="flex-1 text-left truncate">{m.label}</span>}
                {!collapsed && hasChildren && <ChevronRight size={12} className={cx('text-faint transition-transform', open && 'rotate-90')} />}
                {selfActive && <span className="absolute right-0 top-0 bottom-0 w-[2px] bg-accent" />}
              </button>
              {hasChildren && open && (
                <div>
                  {m.children!.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => onSelect(c.key)}
                      className={cx(
                        'relative w-full h-[40px] pl-[37px] pr-2 text-left text-[13px] truncate cursor-pointer transition-colors',
                        c.key === active ? 'bg-accent-soft text-accent' : 'text-ink hover:text-accent',
                      )}
                    >
                      {c.label}
                      {c.key === active && <span className="absolute right-0 top-0 bottom-0 w-[2px] bg-accent" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cx('h-[30px] border-t border-line flex items-center gap-2.5 text-[13px] text-ink hover:text-accent cursor-pointer', collapsed ? 'justify-center' : 'pl-[18px]')}
      >
        {collapsed ? <PanelLeftOpen size={15} strokeWidth={1.6} /> : <PanelLeftClose size={15} strokeWidth={1.6} />}
        {!collapsed && '收起菜单'}
      </button>
    </aside>
  )
}

export function TabsBar({ tabs, active, onSelect, onClose }: { tabs: { key: string; title: string }[]; active: string; onSelect: (k: string) => void; onClose: (k: string) => void }) {
  return (
    <div className="h-[34px] shrink-0 flex items-end border-b border-line bg-white pl-3 pr-3">
      <div className="flex-1 flex items-end overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <div
            key={t.key}
            onClick={() => onSelect(t.key)}
            className={cx('group h-[34px] flex items-center gap-1.5 pl-1.5 pr-2 mr-2 text-[11px] cursor-pointer whitespace-nowrap border-b-2 transition-colors', t.key === active ? 'text-accent border-accent' : 'text-ink border-transparent hover:text-accent')}
          >
            <span className="max-w-[200px] truncate">{t.title}</span>
            <button
              aria-label="关闭标签"
              onClick={(e) => {
                e.stopPropagation()
                onClose(t.key)
              }}
              className="text-faint hover:text-ink cursor-pointer"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
      <ChevronDown size={14} className="text-faint mb-1.5" />
    </div>
  )
}

export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted h-[50px] shrink-0 px-3">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={11} className="text-faint" />}
          <span className={i === items.length - 1 ? 'text-ink' : ''}>{it}</span>
        </span>
      ))}
    </div>
  )
}
