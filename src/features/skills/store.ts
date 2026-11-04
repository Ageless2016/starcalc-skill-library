import { useSyncExternalStore } from 'react'
import type { Folder, ParsedSkill, Skill, SkillFile, SkillVersion } from './types'
import { CURRENT_USER } from './users'
import { SKILL_MD, buildSkillMd, parseFrontmatter, setFrontmatterFields } from './spec'
import { seedState } from './seed'

export interface SkillState {
  folders: Folder[]
  skills: Skill[]
  versions: SkillVersion[]
}

const KEY = 'starcalc.skill-library.v1'

function normalizeState(value: Omit<SkillState, 'versions'> & { versions?: SkillVersion[] }): SkillState {
  const versions = (value.versions ?? value.skills.map((s) => ({
    id: `${s.id}-v1`,
    skillId: s.id,
    version: 1,
    name: s.name,
    displayName: s.displayName ?? s.name,
    description: s.description,
    folderId: s.folderId,
    owner: s.owner,
    files: s.files,
    dirs: s.dirs,
    updatedBy: s.updatedBy,
    updatedAt: s.updatedAt,
    publishedBy: s.updatedBy,
    publishedAt: s.updatedAt,
  }))).map((v) => ({
    ...v,
    displayName: v.displayName ?? value.skills.find((s) => s.id === v.skillId)?.displayName ?? v.name,
    folderId: v.folderId ?? value.skills.find((s) => s.id === v.skillId)?.folderId ?? null,
    owner: v.owner ?? value.skills.find((s) => s.id === v.skillId)?.owner ?? '',
    updatedBy: v.updatedBy ?? v.publishedBy,
    updatedAt: v.updatedAt ?? v.publishedAt,
  }))
  const skills = value.skills.map((s) => {
    const currentVersion = s.currentVersion ?? (Math.max(0, ...versions.filter((v) => v.skillId === s.id).map((v) => v.version)) || undefined)
    return {
      ...s,
      displayName: s.displayName ?? s.name,
      createdBy: s.createdBy ?? s.owner,
      publishedBy: s.publishedBy ?? versions.find((v) => v.skillId === s.id && v.version === currentVersion)?.publishedBy,
      currentVersion,
    }
  })
  return { folders: value.folders, skills, versions }
}

function load(): SkillState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalizeState(JSON.parse(raw))
  } catch {
    /* ignore corrupt storage */
  }
  return normalizeState(seedState())
}

let state: SkillState = load()
const listeners = new Set<() => void>()

function commit(next: SkillState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    console.warn('技能库数据超出本地存储容量，刷新后可能丢失')
  }
  listeners.forEach((l) => l())
}

export function useSkillState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const getSkillState = () => state

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/* ---------- folders ---------- */

export function descendantIds(folders: Folder[], id: string): string[] {
  const out = [id]
  for (let i = 0; i < out.length; i++) folders.filter((f) => f.parentId === out[i]).forEach((f) => out.push(f.id))
  return out
}

export function folderPath(folders: Folder[], id: string | null): string {
  const parts: string[] = []
  let cur = folders.find((f) => f.id === id)
  while (cur) {
    parts.unshift(cur.name)
    cur = folders.find((f) => f.id === cur!.parentId)
  }
  return parts.join(' / ')
}

export function addFolder(name: string, parentId: string | null) {
  const folder: Folder = { id: uid(), name, parentId, createdAt: Date.now() }
  commit({ ...state, folders: [...state.folders, folder] })
  return folder
}

export function renameFolder(id: string, name: string) {
  commit({ ...state, folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)) })
}

export function deleteFolder(id: string) {
  commit({ ...state, folders: state.folders.filter((f) => f.id !== id) })
}

/* ---------- skills ---------- */

export interface SkillInput {
  name: string
  displayName: string
  description: string
  folderId: string | null
  owner: string
  dirs?: string[]
}

export function createSkill(input: SkillInput) {
  const now = Date.now()
  const skill: Skill = {
    id: uid(),
    name: input.name,
    displayName: input.displayName || input.name,
    description: input.description,
    folderId: input.folderId,
    owner: input.owner,
    createdAt: now,
    createdBy: CURRENT_USER.id,
    updatedAt: now,
    updatedBy: CURRENT_USER.id,
    files: [{ path: SKILL_MD, content: buildSkillMd(input.name, input.description), encoding: 'utf8' }],
    dirs: input.dirs ?? [],
  }
  commit({ ...state, skills: [skill, ...state.skills] })
  return skill
}

export function sameFiles(a: SkillFile[], b: SkillFile[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort((x, y) => x.path.localeCompare(y.path))
  const sb = [...b].sort((x, y) => x.path.localeCompare(y.path))
  return sa.every((f, i) => f.path === sb[i].path && f.content === sb[i].content && f.encoding === sb[i].encoding)
}

export function sameDirs(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((d, i) => d === sb[i])
}

export function updateSkillInfo(id: string, patch: SkillInput) {
  commit({
    ...state,
    skills: state.skills.map((s) => {
      if (s.id !== id) return s
      const files = s.files.map((f) =>
        f.path === SKILL_MD
          ? { ...f, content: setFrontmatterFields(f.content, { name: s.name, description: patch.description }) }
          : f,
      )
      return { ...s, ...patch, name: s.name, dirs: s.dirs, files, updatedAt: Date.now(), updatedBy: CURRENT_USER.id }
    }),
  })
}

export function patchSkill(id: string, patch: Partial<Pick<Skill, 'folderId' | 'owner' | 'displayName'>>) {
  commit({
    ...state,
    skills: state.skills.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now(), updatedBy: CURRENT_USER.id } : s)),
  })
}

/** Persist the editor working copy; description is derived from SKILL.md and name stays immutable. */
export function saveSkillFiles(id: string, files: SkillFile[], dirs: string[], info?: Pick<Skill, 'displayName' | 'folderId' | 'owner'>) {
  const md = files.find((f) => f.path === SKILL_MD)
  const fm = md ? parseFrontmatter(md.content) : null
  commit({
    ...state,
    skills: state.skills.map((s) =>
      s.id === id
        ? {
            ...s,
            displayName: info?.displayName ?? s.displayName,
            folderId: info !== undefined ? info.folderId : s.folderId,
            owner: info?.owner ?? s.owner,
            name: s.name,
            description: typeof fm?.data.description === 'string' ? fm.data.description : s.description,
            files,
            dirs,
            updatedAt: Date.now(),
            updatedBy: CURRENT_USER.id,
          }
        : s,
    ),
  })
}

export function publishSkill(id: string, files: SkillFile[], dirs: string[], info?: Pick<Skill, 'displayName' | 'folderId' | 'owner'>) {
  const skill = state.skills.find((s) => s.id === id)
  if (!skill) return null
  const now = Date.now()
  const md = files.find((f) => f.path === SKILL_MD)
  const fm = md ? parseFrontmatter(md.content) : null
  const nextDisplayName = info?.displayName ?? skill.displayName
  const nextDescription = typeof fm?.data.description === 'string' ? fm.data.description : skill.description
  const nextFolderId = info !== undefined ? info.folderId : skill.folderId
  const nextOwner = info?.owner ?? skill.owner
  const draftChanged =
    nextDisplayName !== skill.displayName ||
    nextDescription !== skill.description ||
    nextFolderId !== skill.folderId ||
    nextOwner !== skill.owner ||
    !sameFiles(files, skill.files) ||
    !sameDirs(dirs, skill.dirs)
  const updatedAt = draftChanged ? now : skill.updatedAt
  const updatedBy = draftChanged ? CURRENT_USER.id : skill.updatedBy
  const version: SkillVersion = {
    id: uid(),
    skillId: id,
    version: Math.max(0, ...state.versions.filter((v) => v.skillId === id).map((v) => v.version)) + 1,
    name: skill.name,
    displayName: nextDisplayName,
    description: nextDescription,
    folderId: nextFolderId,
    owner: nextOwner,
    files: files.map((f) => ({ ...f })),
    dirs: [...dirs],
    updatedBy,
    updatedAt,
    publishedBy: CURRENT_USER.id,
    publishedAt: now,
  }
  commit({
    ...state,
    skills: state.skills.map((s) =>
      s.id === id
        ? {
            ...s,
            name: version.name,
            displayName: version.displayName,
            description: version.description,
            folderId: version.folderId,
            owner: version.owner,
            files: version.files,
            dirs: version.dirs,
            currentVersion: version.version,
            publishedBy: CURRENT_USER.id,
            updatedAt,
            updatedBy,
          }
        : s,
    ),
    versions: [...state.versions, version],
  })
  return version
}

export function deleteSkills(ids: string[]) {
  commit({ ...state, skills: state.skills.filter((s) => !ids.includes(s.id)), versions: state.versions.filter((v) => !ids.includes(v.skillId)) })
}

export function importSkills(items: (ParsedSkill & { expectedUpdatedAt?: number })[], folderId: string | null, owner: string, overwrite: boolean) {
  const now = Date.now()
  let skills = [...state.skills]
  let added = 0
  let replaced = 0
  let conflicted = 0
  for (const item of items) {
    const existing = skills.find((s) => s.name === item.name)
    if (existing && !overwrite) continue
    if (existing && (isEditorDirty(existing.id) || (item.expectedUpdatedAt !== undefined && item.expectedUpdatedAt !== existing.updatedAt))) {
      conflicted++
      continue
    }
    if (existing) {
      replaced++
      skills = skills.map((s) =>
        s.id === existing.id
          ? { ...s, description: item.description, files: item.files, dirs: item.dirs, updatedAt: now, updatedBy: CURRENT_USER.id }
          : s,
      )
    } else {
      added++
      skills.unshift({
        id: uid(),
        name: item.name,
        displayName: item.name,
        description: item.description,
        folderId,
        owner,
        createdAt: now,
        createdBy: CURRENT_USER.id,
        updatedAt: now,
        updatedBy: CURRENT_USER.id,
        files: item.files,
        dirs: item.dirs,
      })
    }
  }
  commit({ ...state, skills })
  return { added, replaced, conflicted }
}

/* ---------- unsaved editor tracking ---------- */

const dirtyEditors = new Set<string>()
export const setEditorDirty = (id: string, dirty: boolean) => (dirty ? dirtyEditors.add(id) : dirtyEditors.delete(id))
export const isEditorDirty = (id: string) => dirtyEditors.has(id)
