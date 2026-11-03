import JSZip from 'jszip'
import type { ParsedSkill, Skill, SkillFile } from './types'
import { SKILL_MD, isTextPath, parseFrontmatter } from './spec'

function dataUrlToBase64(content: string) {
  return content.includes(',') ? content.split(',')[1] : content
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadFile(file: SkillFile) {
  const name = file.path.split('/').pop() ?? 'file'
  if (file.encoding === 'base64') {
    const bin = atob(dataUrlToBase64(file.content))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    downloadBlob(new Blob([bytes]), name)
  } else downloadBlob(new Blob([file.content], { type: 'text/plain;charset=utf-8' }), name)
}

function addSkill(zip: JSZip, skill: Pick<Skill, 'name' | 'files' | 'dirs'>) {
  const root = zip.folder(skill.name)!
  for (const d of skill.dirs) root.folder(d)
  for (const f of skill.files) {
    if (f.encoding === 'base64') root.file(f.path, dataUrlToBase64(f.content), { base64: true })
    else root.file(f.path, f.content)
  }
}

export async function exportSkills(skills: (Pick<Skill, 'name' | 'files' | 'dirs'> & { version?: number })[]) {
  const zip = new JSZip()
  skills.forEach((s) => addSkill(zip, s))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  downloadBlob(blob, skills.length === 1 ? `${skills[0].name}${skills[0].version ? `-v${skills[0].version}` : '-draft'}.zip` : `skills-export-${stamp}.zip`)
}

function readMeta(md: string, fallbackName: string) {
  const fm = parseFrontmatter(md)
  const name = typeof fm.data.name === 'string' && fm.data.name ? fm.data.name : fallbackName
  const description = typeof fm.data.description === 'string' ? fm.data.description : ''
  return { has: fm.has, name, description }
}

async function parseZip(file: File): Promise<ParsedSkill[]> {
  const zip = await JSZip.loadAsync(file)
  const entries = Object.values(zip.files).filter(
    (e) => !e.name.startsWith('__MACOSX/') && !e.name.split('/').some((p) => p === '.DS_Store'),
  )
  const roots = entries
    .filter((e) => !e.dir && (e.name === SKILL_MD || e.name.endsWith(`/${SKILL_MD}`)))
    .map((e) => e.name.slice(0, -SKILL_MD.length))
    // a SKILL.md nested inside another skill belongs to that skill, keep the shallowest roots
    .sort((a, b) => a.length - b.length)
    .filter((r, i, arr) => !arr.slice(0, i).some((p) => r !== p && r.startsWith(p)))
  if (!roots.length)
    return [{ name: file.name, description: '', files: [], dirs: [], source: file.name, error: '压缩包中未找到 SKILL.md' }]
  if (roots.length !== 1 || !roots[0])
    return [{ name: file.name, description: '', files: [], dirs: [], source: file.name, error: '每个 ZIP 压缩包必须且只能包含一个技能目录' }]

  const result: ParsedSkill[] = []
  for (const root of roots) {
    const files: SkillFile[] = []
    const dirs: string[] = []
    for (const e of entries) {
      if (!e.name.startsWith(root) || e.name === root) continue
      const rel = e.name.slice(root.length)
      if (e.dir) {
        dirs.push(rel.replace(/\/$/, ''))
        continue
      }
      if (isTextPath(rel)) files.push({ path: rel, content: await e.async('string'), encoding: 'utf8' })
      else files.push({ path: rel, content: await e.async('base64'), encoding: 'base64' })
    }
    const md = files.find((f) => f.path === SKILL_MD)!.content
    const dirName = root.replace(/\/$/, '').split('/').pop() || file.name.replace(/\.zip$/i, '')
    const meta = readMeta(md, dirName)
    result.push({
      name: meta.name,
      description: meta.description,
      files,
      dirs,
      source: `${file.name}${root ? ` / ${root.replace(/\/$/, '')}` : ''}`,
      error: meta.has ? undefined : 'SKILL.md 缺少 YAML frontmatter',
    })
  }
  return result
}

export async function parseImportFiles(list: File[]): Promise<ParsedSkill[]> {
  const out: ParsedSkill[] = []
  for (const f of list) {
    try {
      if (/\.(zip|skill)$/i.test(f.name)) out.push(...(await parseZip(f)))
      else if (/\.md$/i.test(f.name)) {
        const text = await f.text()
        const meta = readMeta(text, '')
        out.push({
          name: meta.name,
          description: meta.description,
          files: [{ path: SKILL_MD, content: text, encoding: 'utf8' }],
          dirs: [],
          source: f.name,
          error: meta.has ? undefined : 'SKILL.md 缺少 YAML frontmatter',
        })
      } else out.push({ name: f.name, description: '', files: [], dirs: [], source: f.name, error: '不支持的文件类型' })
    } catch {
      out.push({ name: f.name, description: '', files: [], dirs: [], source: f.name, error: '文件解析失败' })
    }
  }
  return out
}

export function readUploadedFile(file: File): Promise<SkillFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const text = isTextPath(file.name)
    reader.onload = () =>
      resolve({
        path: file.name,
        content: text ? String(reader.result) : dataUrlToBase64(String(reader.result)),
        encoding: text ? 'utf8' : 'base64',
      })
    reader.onerror = () => reject(reader.error)
    if (text) reader.readAsText(file)
    else reader.readAsDataURL(file)
  })
}
