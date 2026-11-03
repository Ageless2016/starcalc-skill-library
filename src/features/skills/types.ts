export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: number
}

export interface SkillFile {
  /** Path relative to the skill root, e.g. `SKILL.md` or `scripts/run.py`. */
  path: string
  content: string
  encoding: 'utf8' | 'base64'
}

export interface Skill {
  id: string
  name: string
  displayName: string
  description: string
  folderId: string | null
  owner: string
  createdAt: number
  createdBy: string
  updatedAt: number
  updatedBy: string
  publishedBy?: string
  currentVersion?: number
  files: SkillFile[]
  /** Explicit directories (kept so empty folders survive). */
  dirs: string[]
}

export interface SkillVersion {
  id: string
  skillId: string
  version: number
  name: string
  displayName: string
  description: string
  folderId: string | null
  owner: string
  files: SkillFile[]
  dirs: string[]
  updatedBy: string
  updatedAt: number
  publishedBy: string
  publishedAt: number
}

export interface User {
  id: string
  name: string
}

export interface ParsedSkill {
  name: string
  description: string
  files: SkillFile[]
  dirs: string[]
  source: string
  error?: string
}
