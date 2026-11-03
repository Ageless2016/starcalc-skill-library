import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { History, X } from 'lucide-react'
import { Button, Pagination } from '../../components/ui'
import type { SkillVersion } from './types'
import { userLabel } from './users'
import { formatTime } from './time'

interface Props {
  open: boolean
  skillName: string
  versions: SkillVersion[]
  currentVersion?: number
  onClose: () => void
  onView: (version: SkillVersion) => void
}

export default function VersionDrawer({ open, skillName, versions, currentVersion, onClose, onView }: Props) {
  const [page, setPage] = useState(1)
  useEffect(() => {
    if (open) setPage(1)
  }, [open, skillName])
  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open, onClose])

  if (!open) return null
  const sorted = [...versions].sort((a, b) => b.version - a.version)
  const pages = Math.max(1, Math.ceil(sorted.length / 20))
  const current = Math.min(page, pages)
  const pageItems = sorted.slice((current - 1) * 20, current * 20)

  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="版本记录">
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.25)]" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-[460px] bg-white shadow-2xl flex flex-col">
        <div className="h-[50px] shrink-0 px-5 border-b border-line flex items-center gap-3">
          <History size={18} className="text-brand" />
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-medium text-ink">版本记录</div>
            <div className="text-[12px] text-muted truncate">{skillName}</div>
          </div>
          <button aria-label="关闭版本记录" onClick={onClose} className="size-8 flex items-center justify-center rounded-[3px] text-muted hover:text-ink hover:bg-canvas cursor-pointer">
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {sorted.length ? (
            pageItems.map((version) => (
              <div key={version.id} className="px-5 py-4 border-b border-line flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[15px] font-semibold text-ink">v{version.version}</span>
                    {version.version === currentVersion && <span className="px-1.5 h-[20px] leading-[20px] rounded-[2px] text-[11px] bg-[#E8F7EE] text-[#12A150]">线上版本</span>}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">发布人：{userLabel(version.publishedBy)}</div>
                  <div className="mt-1 text-[12px] text-muted tabular-nums">发布时间：{formatTime(version.publishedAt)}</div>
                </div>
                <Button variant="ghost" className="shrink-0" onClick={() => onView(version)}>
                  查看
                </Button>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted">
              <History size={32} strokeWidth={1.3} className="text-faint" />
              <div className="mt-3 text-[14px]">暂无发布版本</div>
              <div className="mt-1 text-[12px]">首次发布后，版本记录会显示在这里</div>
            </div>
          )}
        </div>
        <div className="shrink-0 px-5 py-3 flex justify-end">
          <Pagination total={sorted.length} page={current} pageSize={20} simple onChange={(p) => setPage(p)} />
        </div>
      </aside>
    </div>,
    document.body,
  )
}
