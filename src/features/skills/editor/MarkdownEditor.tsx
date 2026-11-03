import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import { $prose, replaceAll } from '@milkdown/kit/utils'
import { keymap } from '@milkdown/kit/prose/keymap'
import { Plugin } from '@milkdown/kit/prose/state'
import { serializerCtx } from '@milkdown/kit/core'
import { EditorView } from '@codemirror/view'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { linkTooltipAPI } from '@milkdown/kit/component/link-tooltip'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import './markdown-editor.css'
import { joinFrontmatter, splitFrontmatter } from '../spec'
import { cx } from '../../../components/ui'

interface Props {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  /** Map a Markdown image URL to something the browser can display (e.g. skill assets as data URLs). */
  resolveUrl?: (url: string) => string
  /** Store a pasted/uploaded image and return the URL to write into the Markdown. */
  uploadImage?: (file: File) => Promise<string>
}

const leadingBlank = (s: string) => s.match(/^\s*/)?.[0] ?? ''

/** Light CodeMirror theme for code blocks (Crepe defaults to One Dark, which clashes with the light UI). */
const codeTheme = [
  EditorView.theme({
    '&': { backgroundColor: 'transparent', color: '#1f2329', fontSize: '13px' },
    '.cm-content': { caretColor: '#1b4c9c', fontFamily: 'var(--font-mono)' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: '#a8adb5' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(27, 76, 156, 0.18)' },
  }),
  syntaxHighlighting(defaultHighlightStyle),
]

/** Extra mainstream shortcuts on top of Milkdown's defaults (Ctrl+Alt+0-6, Ctrl+B/I/E, ...). */
const extraKeymap = $prose((ctx) =>
  keymap({
    'Mod-k': (state) => {
      const { from, to, empty } = state.selection
      if (empty) return false
      ctx.get(linkTooltipAPI.key).addLink(from, to)
      return true
    },
  }),
)

/**
 * Single-surface WYSIWYG Markdown editor (rendered + editable, like SiYuan/Typora).
 * YAML frontmatter is preserved while the Markdown body is edited in the rich editor.
 */
export default function MarkdownEditor({ value, onChange, readOnly, resolveUrl, uploadImage }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const readyRef = useRef(false)
  const { yaml, body } = splitFrontmatter(value)

  // latest props for callbacks living inside the editor instance
  const latest = useRef({ yaml, body, onChange, resolveUrl, uploadImage })
  latest.current = { yaml, body, onChange, resolveUrl, uploadImage }

  // `external` is the last body that came from outside; `baseline` is how the editor serialises it.
  // When the editor emits the baseline we report the original text, so opening a file never dirties it.
  const sync = useRef({ external: body, baseline: '', emitted: body })

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const upload = (file: File) => latest.current.uploadImage?.(file) ?? Promise.resolve(URL.createObjectURL(file))
    const crepe = new Crepe({
      root,
      defaultValue: latest.current.body,
      features: { [Crepe.Feature.Latex]: false, [Crepe.Feature.TopBar]: false, [Crepe.Feature.AI]: false },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: '输入内容，或输入 “/” 插入标题、列表、代码块、表格等', mode: 'block' },
        [Crepe.Feature.BlockEdit]: {
          textGroup: {
            label: '基础',
            text: { label: '正文' },
            h1: { label: '一级标题' },
            h2: { label: '二级标题' },
            h3: { label: '三级标题' },
            h4: { label: '四级标题' },
            h5: { label: '五级标题' },
            h6: { label: '六级标题' },
            quote: { label: '引用' },
            divider: { label: '分割线' },
          },
          listGroup: { label: '列表', bulletList: { label: '无序列表' }, orderedList: { label: '有序列表' }, taskList: { label: '任务列表' } },
          advancedGroup: { label: '高级', image: { label: '图片' }, codeBlock: { label: '代码块' }, table: { label: '表格' }, math: null },
        },
        [Crepe.Feature.Toolbar]: { boldLabel: '加粗', italicLabel: '斜体', strikethroughLabel: '删除线', codeLabel: '行内代码', linkLabel: '链接' },
        [Crepe.Feature.LinkTooltip]: { inputPlaceholder: '粘贴或输入链接…', onCopyLink: () => undefined },
        [Crepe.Feature.CodeMirror]: { theme: codeTheme, searchPlaceholder: '搜索语言', noResultText: '无匹配语言', copyText: '复制', previewLabel: '预览' },
        [Crepe.Feature.ImageBlock]: {
          blockUploadButton: '上传图片',
          blockConfirmButton: '确定',
          blockUploadPlaceholderText: '或粘贴图片链接',
          blockCaptionPlaceholderText: '图片说明',
          inlineUploadButton: '上传',
          inlineConfirmButton: '确定',
          inlineUploadPlaceholderText: '或粘贴图片链接',
          onUpload: upload,
          blockOnUpload: upload,
          inlineOnUpload: upload,
          proxyDomURL: (url: string) => latest.current.resolveUrl?.(url) ?? url,
        },
      },
    })
    const emit = (md: string) => {
      if (!readyRef.current) return
      const s = sync.current
      const next = md === s.baseline ? s.external : leadingBlank(s.external) + md.replace(/^\s+/, '')
      if (next === s.emitted) return
      s.emitted = next
      latest.current.onChange(joinFrontmatter(latest.current.yaml, next))
    }
    // report every document change synchronously (the stock listener is debounced, which would race Ctrl+S)
    const changeReporter = $prose(
      (ctx) =>
        new Plugin({
          view: () => ({
            update: (view, prev) => {
              if (!view.state.doc.eq(prev.doc)) emit(ctx.get(serializerCtx)(view.state.doc))
            },
          }),
        }),
    )
    crepe.editor.use(extraKeymap).use(changeReporter)
    crepeRef.current = crepe
    let disposed = false
    const created = crepe.create().then(() => {
      if (disposed) return
      sync.current.baseline = crepe.getMarkdown()
      readyRef.current = true
    })
    return () => {
      disposed = true
      readyRef.current = false
      crepeRef.current = null
      void created.then(() => crepe.destroy())
    }
  }, [])

  // apply external body changes (discarding drafts, attribute edits, resync after save)
  useEffect(() => {
    const s = sync.current
    if (body === s.emitted) return
    s.external = body
    s.emitted = body
    const crepe = crepeRef.current
    if (!crepe || !readyRef.current) return
    readyRef.current = false
    crepe.editor.action(replaceAll(body))
    s.baseline = crepe.getMarkdown()
    readyRef.current = true
  }, [body])

  useEffect(() => {
    crepeRef.current?.setReadonly(!!readOnly)
  }, [readOnly])

  return (
    <div className={cx('skill-md h-full overflow-auto', readOnly && 'is-readonly')}>
      <div className="max-w-[1080px] mx-auto">
        <div ref={rootRef} />
      </div>
    </div>
  )
}
