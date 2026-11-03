import type { SkillFile } from './types'

/** Agent Skills specification helpers (agentskills.io). */
export const NAME_MAX = 64
export const DESC_MAX = 1024
export const COMPAT_MAX = 500
export const BODY_LINE_LIMIT = 500
export const SKILL_MD = 'SKILL.md'
export const KNOWN_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']
export const STANDARD_DIRS = [
  { name: 'scripts', desc: '可执行脚本（Python、Bash、JS 等），由 Agent 按需运行' },
  { name: 'references', desc: '补充文档，Agent 在需要时按需加载' },
  { name: 'assets', desc: '静态资源：模板、图片、数据文件等' },
]

export function validateName(name: string): string | null {
  if (!name) return '请输入技能名称'
  if (name.length > NAME_MAX) return `名称不能超过 ${NAME_MAX} 个字符`
  if (!/^[a-z0-9-]+$/.test(name)) return '只能输入小写字母、数字和短横线'
  if (name.startsWith('-') || name.endsWith('-')) return '不能以短横线开头或结尾'
  if (name.includes('--')) return '不能包含连续的短横线'
  return null
}

export function validateDescription(desc: string): string | null {
  if (!desc.trim()) return '请输入技能描述'
  if (desc.length > DESC_MAX) return `描述不能超过 ${DESC_MAX} 个字符`
  return null
}

export type FrontmatterValue = string | Record<string, string>

export interface Frontmatter {
  has: boolean
  data: Record<string, FrontmatterValue>
  body: string
  bodyStartLine: number
}

const FM_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/

/** Split raw YAML frontmatter (without the --- fences) from the Markdown body. */
export function splitFrontmatter(content: string): { yaml: string | null; body: string } {
  const m = content.match(FM_RE)
  return m ? { yaml: m[1], body: content.slice(m[0].length) } : { yaml: null, body: content }
}

export function joinFrontmatter(yaml: string | null, body: string) {
  return yaml === null ? body : `---\n${yaml}\n---\n${body}`
}

/** Resolve a Markdown-relative URL against the directory of the file that contains it. */
export function resolveRelative(fromDir: string, url: string): string | null {
  if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/') || url.startsWith('#')) return null
  const parts = fromDir ? fromDir.split('/') : []
  for (const seg of decodeURI(url.split(/[?#]/)[0]).split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (!parts.length) return null
      parts.pop()
    } else parts.push(seg)
  }
  return parts.join('/')
}

/** Relative path from a directory to a target path, both relative to the skill root. */
export function relativePath(fromDir: string, target: string) {
  const from = fromDir ? fromDir.split('/') : []
  const to = target.split('/')
  let i = 0
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++
  return [...Array(from.length - i).fill('..'), ...to.slice(i)].join('/')
}

function unquote(v: string) {
  const s = v.trim()
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    try {
      return JSON.parse(s) as string
    } catch {
      return s.slice(1, -1)
    }
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'")
  return s
}

export function parseFrontmatter(content: string): Frontmatter {
  const m = content.match(FM_RE)
  if (!m) return { has: false, data: {}, body: content, bodyStartLine: 1 }
  const lines = m[1].split(/\r?\n/)
  const data: Record<string, FrontmatterValue> = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!top) {
      i++
      continue
    }
    const [, key, raw] = top
    const value = raw.trim()
    const block: string[] = []
    let j = i + 1
    while (j < lines.length && (/^\s+/.test(lines[j]) || lines[j] === '')) {
      block.push(lines[j])
      j++
    }
    while (block.length && block[block.length - 1].trim() === '') block.pop()
    if (/^[|>][+-]?$/.test(value)) {
      const trimmed = block.map((l) => l.replace(/^\s{1,}/, ''))
      data[key] = value.startsWith('|') ? trimmed.join('\n') : trimmed.join(' ').trim()
    } else if (value === '' && block.length) {
      const map: Record<string, string> = {}
      for (const b of block) {
        const kv = b.trim().match(/^([^:]+):\s*(.*)$/)
        if (kv) map[kv[1].trim()] = unquote(kv[2])
      }
      data[key] = map
    } else {
      data[key] = unquote(value)
    }
    i = j
  }
  const body = content.slice(m[0].length)
  const bodyStartLine = m[0].split('\n').length
  return { has: true, data, body, bodyStartLine }
}

function yamlScalar(v: string) {
  if (v === '' || /[:#[\]{}&*!|>'"%@`,\n]/.test(v) || /^\s|\s$/.test(v) || /^[-?]/.test(v)) return JSON.stringify(v)
  return v
}

/** Replace (or insert) top-level scalar fields in the SKILL.md frontmatter, preserving everything else. */
export function setFrontmatterFields(content: string, fields: Record<string, string>): string {
  const m = content.match(FM_RE)
  if (!m) {
    const head = Object.entries(fields)
      .map(([k, v]) => `${k}: ${yamlScalar(v)}`)
      .join('\n')
    return `---\n${head}\n---\n\n${content}`
  }
  const lines = m[1].split(/\r?\n/)
  const out: string[] = []
  const done = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const top = lines[i].match(/^([A-Za-z0-9_-]+):/)
    if (top && top[1] in fields) {
      out.push(`${top[1]}: ${yamlScalar(fields[top[1]])}`)
      done.add(top[1])
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) i++
      continue
    }
    out.push(lines[i])
  }
  const missing = Object.keys(fields).filter((k) => !done.has(k))
  const insert = missing.map((k) => `${k}: ${yamlScalar(fields[k])}`)
  const merged = missing.includes('name') ? [...insert, ...out] : [...out, ...insert]
  return `---\n${merged.join('\n')}\n---\n${content.slice(m[0].length).replace(/^(?!\r?\n)/, '\n')}`
}

export function titleFromName(name: string) {
  return name
    .split('-')
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ')
}

export function buildSkillMd(name: string, description: string, body?: string) {
  const content =
    body ??
    `# ${titleFromName(name)}

## 适用场景

- 描述在什么情况下应当使用此技能
- 列出用户可能提到的关键词或任务类型

## 操作步骤

1. 第一步：说明 Agent 需要执行的动作
2. 第二步：如需运行脚本，可引用 scripts/ 目录下的文件
3. 第三步：说明结果的输出格式

## 示例

**输入：** 用户的典型请求

**输出：** 期望的结果

## 注意事项

- 常见的边界情况与处理方式
`
  return setFrontmatterFields(content, { name, description })
}

export const TEXT_EXT = new Set([
  'md', 'txt', 'py', 'sh', 'bash', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'yaml', 'yml', 'toml', 'ini',
  'cfg', 'xml', 'html', 'htm', 'css', 'csv', 'tsv', 'sql', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'ps1',
  'bat', 'env', 'gitignore', 'svg', 'r', 'lua', 'php', 'pl', 'swift', 'scala', 'conf', 'log', 'tpl', 'j2', 'jinja',
])

export function extOf(path: string) {
  const base = path.split('/').pop() ?? ''
  const idx = base.lastIndexOf('.')
  return idx >= 0 ? base.slice(idx + 1).toLowerCase() : base.toLowerCase()
}

export function isTextPath(path: string) {
  const base = path.split('/').pop() ?? ''
  return !base.includes('.') || TEXT_EXT.has(extOf(path))
}

export function templateForFile(path: string) {
  const ext = extOf(path)
  const base = path.split('/').pop() ?? ''
  if (ext === 'py') return `#!/usr/bin/env python3\n"""${base}：脚本用途说明"""\n\n\ndef main():\n    pass\n\n\nif __name__ == "__main__":\n    main()\n`
  if (ext === 'sh') return `#!/usr/bin/env bash\n# ${base}：脚本用途说明\nset -euo pipefail\n\n`
  if (ext === 'js' || ext === 'mjs') return `#!/usr/bin/env node\n// ${base}：脚本用途说明\n\n`
  if (ext === 'md') return `# ${base.replace(/\.md$/i, '')}\n\n`
  if (ext === 'json') return `{\n  \n}\n`
  return ''
}

export function fileSize(f: SkillFile) {
  if (f.encoding === 'base64') {
    const b64 = f.content.includes(',') ? f.content.split(',')[1] : f.content
    return Math.floor((b64.length * 3) / 4)
  }
  return new TextEncoder().encode(f.content).length
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export type CheckLevel = 'pass' | 'warn' | 'error'
export interface Check {
  level: CheckLevel
  label: string
  detail?: string
}

export function validateSkill(files: SkillFile[], dirs: string[], otherNames: string[]): Check[] {
  const checks: Check[] = []
  const md = files.find((f) => f.path === SKILL_MD)
  if (!md) {
    checks.push({ level: 'error', label: '缺少 SKILL.md', detail: '技能根目录必须包含 SKILL.md 文件' })
    return checks
  }
  checks.push({ level: 'pass', label: '包含 SKILL.md 入口文件' })
  const fm = parseFrontmatter(md.content)
  if (!fm.has) {
    checks.push({ level: 'error', label: '缺少 YAML frontmatter', detail: 'SKILL.md 需以 --- 包裹的 YAML 元数据开头' })
    return checks
  }
  const name = typeof fm.data.name === 'string' ? fm.data.name : ''
  const nameErr = validateName(name)
  if (nameErr) checks.push({ level: 'error', label: 'name 字段不合规', detail: nameErr })
  else if (otherNames.includes(name))
    checks.push({ level: 'error', label: 'name 与已有技能重名', detail: `技能库中已存在 ${name}` })
  else checks.push({ level: 'pass', label: 'name 字段合规', detail: name })

  const desc = typeof fm.data.description === 'string' ? fm.data.description : ''
  const descErr = validateDescription(desc)
  if (descErr) checks.push({ level: 'error', label: 'description 字段不合规', detail: descErr })
  else if (desc.length < 20)
    checks.push({ level: 'warn', label: 'description 过于简短', detail: '建议同时说明技能做什么、何时使用，便于 Agent 匹配' })
  else checks.push({ level: 'pass', label: 'description 字段合规', detail: `${desc.length} / ${DESC_MAX} 字符` })

  const compat = fm.data.compatibility
  if (typeof compat === 'string' && compat.length > COMPAT_MAX)
    checks.push({ level: 'error', label: 'compatibility 超长', detail: `不能超过 ${COMPAT_MAX} 个字符` })

  const unknown = Object.keys(fm.data).filter((k) => !KNOWN_FIELDS.includes(k))
  if (unknown.length)
    checks.push({ level: 'warn', label: '存在非标准字段', detail: `${unknown.join('、')}；自定义信息建议放入 metadata` })

  const bodyLines = fm.body.split('\n').length
  if (!fm.body.trim()) checks.push({ level: 'warn', label: '正文为空', detail: '建议补充操作步骤、示例与注意事项' })
  else if (bodyLines > BODY_LINE_LIMIT)
    checks.push({ level: 'warn', label: '正文过长', detail: `${bodyLines} 行，建议控制在 ${BODY_LINE_LIMIT} 行内，详细内容拆分至 references/` })
  else checks.push({ level: 'pass', label: '正文长度适中', detail: `${bodyLines} 行` })

  const paths = new Set([...files.map((f) => f.path), ...dirs])
  const missing: string[] = []
  for (const m of fm.body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0].replace(/^\.\//, '')
    if (!target || /^[a-z]+:/i.test(target) || target.startsWith('/')) continue
    if (!paths.has(target.replace(/\/$/, ''))) missing.push(target)
  }
  if (missing.length) checks.push({ level: 'warn', label: '引用的文件不存在', detail: missing.join('、') })
  else checks.push({ level: 'pass', label: '文件引用均有效' })
  return checks
}
