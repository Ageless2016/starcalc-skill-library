import type { User } from './types'

export const USERS: User[] = [
  { id: 'A80531', name: '李明' },
  { id: 'G13333333333', name: '张三' },
  { id: 'G13544447777', name: '王芳' },
  { id: 'G13800001234', name: '赵磊' },
  { id: 'G13966668888', name: '陈静' },
]

export const CURRENT_USER = USERS[0]

export function userLabel(id: string) {
  const u = USERS.find((x) => x.id === id)
  return u ? `${u.id}(${u.name})` : id
}
