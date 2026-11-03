import { useEffect, useState } from 'react'
import { Button, Field, Modal, TextInput } from '../../../components/ui'

const ENTRY_NAME_MAX = 64

interface Props {
  open: boolean
  title: string
  label: string
  initial: string
  prefix?: string
  hint?: string
  onClose: () => void
  /** Return an error message to keep the modal open. */
  onSubmit: (value: string) => string | null
}

export default function PathModal({ open, title, label, initial, prefix, hint, onClose, onSubmit }: Props) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setValue(initial)
      setError(null)
    }
  }, [open, initial])
  const submit = () => {
    const name = value.trim()
    if (!name) {
      setError('请输入名称')
      return
    }
    if (name.length > ENTRY_NAME_MAX) {
      setError(`名称不能超过 ${ENTRY_NAME_MAX} 个字符`)
      return
    }
    if (/[\\:*?"<>|]/.test(name)) {
      setError('名称不能包含特殊字符 \\ : * ? " < > |')
      return
    }
    if (prefix !== undefined && name.includes('/')) {
      setError('名称不能包含 /')
      return
    }
    setError(onSubmit(`${prefix ?? ''}${name}`))
  }
  return (
    <Modal
      open={open}
      title={title}
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={submit}>
            确定
          </Button>
        </>
      }
    >
      <Field label={label} required error={error} hint={hint}>
        {prefix !== undefined ? (
          <div className="flex items-center gap-2">
            <input aria-label="所在路径" value={prefix || '/'} disabled readOnly className="w-[140px] h-8 rounded-[3px] border border-line bg-canvas px-2.5 font-mono text-[13px] text-muted" />
            <TextInput
              autoFocus
              className="flex-1 font-mono"
              placeholder="请输入名称"
              maxLength={ENTRY_NAME_MAX}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        ) : (
          <TextInput
            autoFocus
            className="font-mono"
            maxLength={ENTRY_NAME_MAX}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        )}
      </Field>
    </Modal>
  )
}
