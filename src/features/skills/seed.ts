import type { Folder, Skill, SkillFile } from './types'
import { SKILL_MD, buildSkillMd } from './spec'

const day = 24 * 3600 * 1000
const base = new Date('2026-04-02T09:45:32').getTime()

const folders: Folder[] = [
  { id: 'f-data', name: '数据分析', parentId: null, createdAt: base },
  { id: 'f-report', name: '报表生成', parentId: 'f-data', createdAt: base },
  { id: 'f-metric', name: '指标计算', parentId: 'f-data', createdAt: base },
  { id: 'f-doc', name: '文档处理', parentId: null, createdAt: base },
  { id: 'f-pdf', name: 'PDF', parentId: 'f-doc', createdAt: base },
  { id: 'f-office', name: 'Office 文档', parentId: 'f-doc', createdAt: base },
  { id: 'f-dev', name: '研发工具', parentId: null, createdAt: base },
  { id: 'f-ops', name: '运维巡检', parentId: null, createdAt: base },
]

interface SeedDef {
  name: string
  description: string
  folderId: string
  owner: string
  updatedBy: string
  ago: number
  body?: string
  files?: SkillFile[]
  dirs?: string[]
}

const txt = (path: string, content: string): SkillFile => ({ path, content, encoding: 'utf8' })

const defs: SeedDef[] = [
  {
    name: 'pdf-processing',
    description: '从 PDF 文件中提取文本和表格、填写表单、合并文档。当用户处理 PDF 文件或提到 PDF、表单、文档提取时使用。',
    folderId: 'f-pdf',
    owner: 'G13333333333',
    updatedBy: 'G13333333333',
    ago: 0.2,
    body: `# PDF Processing

## 适用场景

- 用户需要从 PDF 中提取正文文本或表格数据
- 用户需要合并、拆分 PDF，或填写 PDF 表单

## 操作步骤

1. 使用 \`scripts/extract_text.py\` 提取文本：

\`\`\`bash
python scripts/extract_text.py input.pdf --out result.txt
\`\`\`

2. 如果文档包含表格，优先输出为 CSV 格式
3. 表单字段说明详见 [references/FORMS.md](references/FORMS.md)

## 注意事项

- 扫描件需先进行 OCR，提示用户可能存在识别误差
- 加密 PDF 需要用户提供密码
`,
    files: [
      txt(
        'scripts/extract_text.py',
        `#!/usr/bin/env python3
"""extract_text.py：从 PDF 中提取文本"""
import argparse

import pdfplumber


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("--out", default="result.txt")
    args = parser.parse_args()

    with pdfplumber.open(args.pdf) as pdf, open(args.out, "w", encoding="utf-8") as f:
        for page in pdf.pages:
            f.write((page.extract_text() or "") + "\\n")


if __name__ == "__main__":
    main()
`,
      ),
      txt('references/FORMS.md', `# PDF 表单字段说明\n\n| 字段类型 | 说明 |\n| --- | --- |\n| Text | 文本输入框 |\n| CheckBox | 复选框 |\n`),
    ],
    dirs: ['assets'],
  },
  {
    name: 'sales-report-generator',
    description: '根据销售明细数据生成日报、周报和月报，包含同比环比分析和图表。当用户需要销售报表或业绩汇总时使用。',
    folderId: 'f-report',
    owner: 'A80531',
    updatedBy: 'A80531',
    ago: 0.5,
    files: [txt('assets/report-template.md', '# {{period}} 销售报告\n\n## 核心指标\n\n## 区域表现\n')],
    dirs: ['scripts', 'references'],
  },
  {
    name: 'manufacture-stats-query',
    description: '查询巴西工厂生产数据统计接口，可按日期、产线、机型等条件筛选产量与良率数据。',
    folderId: 'f-report',
    owner: 'G13333333333',
    updatedBy: 'G13333333333',
    ago: 1,
  },
  {
    name: 'kpi-calculator',
    description: '按照企业指标口径计算 GMV、转化率、留存率等核心 KPI，并解释计算过程。当用户询问指标数值或口径时使用。',
    folderId: 'f-metric',
    owner: 'G13544447777',
    updatedBy: 'G13544447777',
    ago: 2,
    files: [txt('references/METRICS.md', '# 指标口径\n\n- GMV：下单金额合计（含退款）\n- 转化率：下单用户数 / 访问用户数\n')],
  },
  {
    name: 'data-cleaning',
    description: '对 CSV / Excel 数据进行去重、缺失值填充、格式标准化等清洗操作，并输出清洗报告。',
    folderId: 'f-data',
    owner: 'G13800001234',
    updatedBy: 'A80531',
    ago: 3,
    files: [txt('scripts/clean.py', '#!/usr/bin/env python3\n"""clean.py：数据清洗脚本"""\nimport pandas as pd\n')],
  },
  {
    name: 'docx-writer',
    description: '创建和编辑 Word 文档，支持标题样式、表格、页眉页脚与批注。当用户需要生成 .docx 文件时使用。',
    folderId: 'f-office',
    owner: 'G13966668888',
    updatedBy: 'G13966668888',
    ago: 4,
    dirs: ['scripts', 'assets'],
  },
  {
    name: 'excel-formula-helper',
    description: '根据自然语言需求编写或解释 Excel 公式，包括 VLOOKUP、XLOOKUP、数据透视等常见场景。',
    folderId: 'f-office',
    owner: 'G13544447777',
    updatedBy: 'G13544447777',
    ago: 5,
  },
  {
    name: 'sql-query-builder',
    description: '根据数据表结构和业务问题生成高效的 SQL 查询，并给出索引优化建议。当用户需要编写或优化 SQL 时使用。',
    folderId: 'f-dev',
    owner: 'A80531',
    updatedBy: 'A80531',
    ago: 6,
    files: [txt('references/SCHEMA.md', '# 数据表结构\n\n## dwd_sales_detail\n\n| 字段 | 类型 | 说明 |\n| --- | --- | --- |\n| order_id | string | 订单号 |\n')],
  },
  {
    name: 'code-review',
    description: '按照团队编码规范审查代码变更，指出潜在缺陷、安全风险与可读性问题，并给出修改建议。',
    folderId: 'f-dev',
    owner: 'G13800001234',
    updatedBy: 'G13800001234',
    ago: 8,
  },
  {
    name: 'api-doc-writer',
    description: '根据接口定义自动生成标准化的 API 文档，包括入参、出参、枚举值说明与调用示例。',
    folderId: 'f-dev',
    owner: 'G13333333333',
    updatedBy: 'A80531',
    ago: 9,
  },
  {
    name: 'server-health-check',
    description: '巡检服务器 CPU、内存、磁盘与关键进程状态，生成巡检报告并对异常项给出处理建议。',
    folderId: 'f-ops',
    owner: 'G13966668888',
    updatedBy: 'G13966668888',
    ago: 11,
    files: [txt('scripts/check.sh', '#!/usr/bin/env bash\n# check.sh：服务器健康巡检\nset -euo pipefail\n\ndf -h\nfree -m\n')],
  },
  {
    name: 'log-analyzer',
    description: '分析应用日志，聚合错误类型、定位异常时间段并关联可能的根因。当用户排查线上问题时使用。',
    folderId: 'f-ops',
    owner: 'G13800001234',
    updatedBy: 'G13800001234',
    ago: 14,
  },
]

export function seedState() {
  const skills: Skill[] = defs.map((d, i) => {
    const t = base - d.ago * day - i * 3600 * 1000
    return {
      id: `seed-${i}`,
      name: d.name,
      displayName: d.name,
      description: d.description,
      folderId: d.folderId,
      owner: d.owner,
      createdAt: t - 7 * day,
      createdBy: d.owner,
      updatedAt: t,
      updatedBy: d.updatedBy,
      files: [txt(SKILL_MD, buildSkillMd(d.name, d.description, d.body)), ...(d.files ?? [])],
      dirs: d.dirs ?? [],
    }
  })
  return { folders, skills }
}
