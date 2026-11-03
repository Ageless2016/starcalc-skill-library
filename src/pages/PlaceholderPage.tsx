import { LayoutTemplate } from 'lucide-react'

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted gap-3">
      <div className="size-14 rounded-full bg-canvas flex items-center justify-center">
        <LayoutTemplate size={24} className="text-faint" />
      </div>
      <div className="text-[14px] text-ink">{title}</div>
      <div className="text-[13px]">该模块不在本次原型范围内</div>
    </div>
  )
}
