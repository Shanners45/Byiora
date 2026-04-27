"use client"

import * as React from "react"
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import { Bold, Italic, Link as LinkIcon, List, Heading } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RichTextEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ id, value, onChange, placeholder, className = "" }: RichTextEditorProps) {
  // Helper to convert plain text with \n to HTML paragraphs for proper block handling
  const parseInitialContent = (val: string) => {
    if (!val) return ''
    // If it already contains HTML tags like <p>, <ul>, <h3>, etc., fix legacy <br> inside <p> blocks
    if (val.includes('<p>') || val.includes('<ul>') || val.includes('<h3>')) {
      // Split <br> tags inside <p> blocks into separate <p> blocks for proper block handling
      return val.replace(/<p>(.*?)<\/p>/gs, (match, inner) => {
        if (inner.includes('<br>') || inner.includes('<br/>') || inner.includes('<br />')) {
          return inner
            .split(/<br\s*\/?>/gi)
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
            .map((line: string) => `<p>${line}</p>`)
            .join('')
        }
        return match
      })
    }
    // Convert plain text newlines to separate paragraph blocks
    return val.split('\n').map(line => line.trim() === '' ? '<p><br></p>' : `<p>${line}</p>`).join('')
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Disable the default hardBreak so Enter always creates new paragraphs
        hardBreak: false,
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#7E3AF2] hover:underline',
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      })
    ],
    content: parseInitialContent(value),
    editorProps: {
      attributes: {
        id: id || '',
        class: 'w-full p-3 min-h-[120px] outline-none resize-y text-[#1F2937] focus:outline-none',
      },
      // Intercept Enter key to always create new paragraph blocks (never <br>)
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          // Let TipTap handle it normally — with hardBreak disabled,
          // Enter will create a new paragraph by default
          return false
        }
        if (event.key === 'Enter' && event.shiftKey) {
          // For Shift+Enter, also create a new paragraph instead of <br>
          const { state, dispatch } = view
          const { $from } = state.selection
          const tr = state.tr.split($from.pos)
          dispatch(tr)
          return true
        }
        return false
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    }
  })

  // Update editor content if value prop changes externally (e.g. when editing a different FAQ)
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      const parsedValue = parseInitialContent(value)
      if (parsedValue !== editor.getHTML()) {
        editor.commands.setContent(parsedValue)
      }
    }
  }, [value, editor])

  if (!editor) {
    return null
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl)
    
    // cancelled
    if (url === null) {
      return
    }
    
    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    // Security: block javascript: protocol to prevent XSS
    const sanitizedUrl = url.trim()
    try {
      const parsed = new URL(sanitizedUrl, window.location.origin)
      if (parsed.protocol === 'javascript:') {
        return
      }
    } catch {
      // If it's not a valid URL, allow relative paths but still block javascript:
      if (sanitizedUrl.toLowerCase().startsWith('javascript:')) {
        return
      }
    }
    
    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: sanitizedUrl }).run()
  }

  // Custom bullet list toggle that splits <br>-joined lines into separate list items
  const toggleBulletList = () => {
    // If already in a bullet list, just toggle it off
    if (editor.isActive('bulletList')) {
      editor.chain().focus().toggleBulletList().run()
      return
    }

    // Get the current HTML and check if it contains <br> inside paragraphs
    const html = editor.getHTML()
    
    // Check if the selected content or entire content has <br> tags inside <p> tags
    // that need splitting before list conversion
    const hasBrInParagraphs = /<p>.*<br>.*<\/p>/s.test(html)
    
    if (hasBrInParagraphs) {
      // Split all <br> inside <p> tags into separate <p> blocks first
      const fixedHtml = html.replace(/<p>(.*?)<\/p>/gs, (match, inner) => {
        if (inner.includes('<br>')) {
          return inner
            .split(/<br\s*\/?>/gi)
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
            .map((line: string) => `<p>${line}</p>`)
            .join('')
        }
        return match
      })
      
      // Set the fixed content, then toggle bullet list
      editor.commands.setContent(fixedHtml)
      // Select all content
      editor.commands.selectAll()
    }
    
    // Now toggle bullet list — each <p> becomes its own <li>
    editor.chain().focus().toggleBulletList().run()
  }

  return (
    <div className={`flex flex-col border-2 rounded-md overflow-hidden bg-white focus-within:ring-0 focus-within:border-[#F59E0B] transition-colors ${className}`}>
      <div className="flex items-center gap-1 p-1 border-b bg-[#F9FAFB] flex-wrap">
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          className={`h-8 w-8 p-0 text-[#4B5563] hover:text-[#1F2937] hover:bg-[#E5E7EB] ${editor.isActive('bold') ? 'bg-[#E5E7EB] text-[#1F2937]' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          className={`h-8 w-8 p-0 text-[#4B5563] hover:text-[#1F2937] hover:bg-[#E5E7EB] ${editor.isActive('italic') ? 'bg-[#E5E7EB] text-[#1F2937]' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          className={`h-8 w-8 p-0 text-[#4B5563] hover:text-[#1F2937] hover:bg-[#E5E7EB] ${editor.isActive('link') ? 'bg-[#E5E7EB] text-[#1F2937]' : ''}`}
          onClick={setLink}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-[#D1D5DB] mx-1"></div>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          className={`h-8 w-8 p-0 text-[#4B5563] hover:text-[#1F2937] hover:bg-[#E5E7EB] ${editor.isActive('heading', { level: 3 }) ? 'bg-[#E5E7EB] text-[#1F2937]' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading"
        >
          <Heading className="h-4 w-4" />
        </Button>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          className={`h-8 w-8 p-0 text-[#4B5563] hover:text-[#1F2937] hover:bg-[#E5E7EB] ${editor.isActive('bulletList') ? 'bg-[#E5E7EB] text-[#1F2937]' : ''}`}
          onClick={toggleBulletList}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} className="cursor-text" />
      <style>{`
        .tiptap {
          line-height: 1.4;
        }
        .tiptap p {
          margin-top: 0.1em;
          margin-bottom: 0.15em;
        }
        .tiptap ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-top: 0.15em;
          margin-bottom: 0.15em;
        }
        .tiptap li {
          margin-top: 0.1em;
          margin-bottom: 0.1em;
        }
        .tiptap h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 0.5em;
          margin-bottom: 0.25em;
        }
        .tiptap a {
          color: #7E3AF2;
          text-decoration: underline;
          cursor: pointer;
        }
        .tiptap p.is-editor-empty:first-child::before {
          color: #9CA3AF;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
