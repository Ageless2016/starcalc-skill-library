import type { Folder } from './types'

export interface FlatFolder {
  folder: Folder
  depth: number
}

export function flattenFolders(folders: Folder[], parentId: string | null = null, depth = 0): FlatFolder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .flatMap((f) => [{ folder: f, depth }, ...flattenFolders(folders, f.id, depth + 1)])
}
