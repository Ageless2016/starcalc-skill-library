import { CalendarDays, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Checkbox, Pagination, TextInput } from '../components/ui'

const ROWS = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  block: '生产',
  name: 'getGmobileAiBaxiManufacture',
  desc: '这是一个巴西工厂生产数据统计接口。可根据以下条件查询产量、良率等指标数据',
  note: '-',
  time: '2026-03-25 17:09:00',
  user: 'G13333333333(张三)',
}))

export default function ApiInfoPage() {
  const [sel, setSel] = useState<number[]>([])
  const [page, setPage] = useState({ p: 1, s: 20 })
  return (
    <div className="h-full flex flex-col px-3 pb-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center h-8 w-[278px] border border-line rounded-[3px] px-4 text-[11px] text-faint gap-6">
          <span>修改时间</span>
          <span>-</span>
          <span className="flex-1">修改时间</span>
          <CalendarDays size={13} />
        </div>
        <TextInput className="w-[320px]" icon={<Search size={13} />} placeholder="请输入关键字" />
        <Button variant="primary" className="w-16">查询</Button>
        <Button className="w-16">重置</Button>
        <div className="ml-auto text-[11px] text-ink">
          最近同步时间：2026-04-02 09:45:32 <a className="text-link ml-1 cursor-pointer">全量同步</a>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 mb-2 px-2">
        <Button variant="link" icon={<Plus size={13} />}>新增数据</Button>
        <Button variant="link" icon={<Plus size={13} />}>导入数据</Button>
        <Button variant="link" icon={<Plus size={13} />}>导出数据</Button>
        <Button variant="link" icon={<Trash2 size={13} />} disabled={!sel.length}>删除</Button>
      </div>
      <div className="flex-1 overflow-auto px-2">
        <table className="w-full text-[11px] text-ink">
          <thead>
            <tr className="bg-canvas h-10 text-left font-medium">
              <th className="w-10 pl-3">
                <Checkbox checked={sel.length === ROWS.length} indeterminate={sel.length > 0 && sel.length < ROWS.length} onChange={(v) => setSel(v ? ROWS.map((r) => r.id) : [])} />
              </th>
              {['序号', '所属板块', '接口名称', '接口描述', '接口备注', '修改时间', '修改人'].map((h) => (
                <th key={h} className="font-medium px-3">{h}</th>
              ))}
              <th className="font-medium px-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.id} className="h-[39px] border-b border-line hover:bg-[#FAFBFC]">
                <td className="pl-3">
                  <Checkbox checked={sel.includes(r.id)} onChange={(v) => setSel((s) => (v ? [...s, r.id] : s.filter((x) => x !== r.id)))} />
                </td>
                <td className="px-3">{r.id}</td>
                <td className="px-3">{r.block}</td>
                <td className="px-3">{r.name}</td>
                <td className="px-3 max-w-[260px] truncate">{r.desc}</td>
                <td className="px-3">{r.note}</td>
                <td className="px-3">{r.time}</td>
                <td className="px-3">{r.user}</td>
                <td className="px-3 text-center text-link space-x-2"><a className="cursor-pointer">查看</a><a className="cursor-pointer">删除</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pt-3 px-2">
        <Pagination total={10} page={page.p} pageSize={page.s} onChange={(p, s) => setPage({ p, s })} />
      </div>
    </div>
  )
}
