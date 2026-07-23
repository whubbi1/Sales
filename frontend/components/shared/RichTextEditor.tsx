'use client'
// Minimal Outlook-style WYSIWYG editor (bold/italic/underline/lists/link) — a contentEditable
// div driven by document.execCommand rather than a new dependency, consistent with this
// codebase not pulling in a rich-text library anywhere else.
import { useRef, useEffect } from 'react'

const toolBtnStyle: React.CSSProperties = {
  padding: '5px 9px', fontSize: '12px', border: '1px solid #E2E8F0', borderRadius: '5px',
  background: 'white', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: '#3F3F3F',
}

export function RichTextEditor({ value, onChange, minHeight = '220px' }: { value: string; onChange: (html: string) => void; minHeight?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const lastValue = useRef(value)

  // Only pushes external value changes into the DOM when the editor isn't focused — otherwise
  // every keystroke's onChange would immediately overwrite the caret position via this effect.
  useEffect(() => {
    if (ref.current && value !== lastValue.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = value || ''
      lastValue.current = value
    }
  }, [value])

  const handleInput = () => {
    if (!ref.current) return
    lastValue.current = ref.current.innerHTML
    onChange(ref.current.innerHTML)
  }
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    handleInput()
  }
  const insertLink = () => {
    const url = window.prompt('Link URL (include https://)')
    if (url) exec('createLink', url)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px', padding: '6px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
        <button type="button" title="Bold" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} style={{ ...toolBtnStyle, fontWeight: 800 }}>B</button>
        <button type="button" title="Italic" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} style={{ ...toolBtnStyle, fontStyle: 'italic' }}>I</button>
        <button type="button" title="Underline" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} style={{ ...toolBtnStyle, textDecoration: 'underline' }}>U</button>
        <button type="button" title="Bullet list" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')} style={toolBtnStyle}>• List</button>
        <button type="button" title="Numbered list" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertOrderedList')} style={toolBtnStyle}>1. List</button>
        <button type="button" title="Insert link" onMouseDown={e => e.preventDefault()} onClick={insertLink} style={toolBtnStyle}>🔗 Link</button>
        <button type="button" title="Clear formatting" onMouseDown={e => e.preventDefault()} onClick={() => exec('removeFormat')} style={toolBtnStyle}>Clear</button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning
        style={{ minHeight, padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Montserrat, sans-serif', color: '#3F3F3F', outline: 'none', overflowY: 'auto' }}
      />
    </div>
  )
}
