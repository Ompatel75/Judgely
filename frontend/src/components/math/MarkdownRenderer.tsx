import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { Copy, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
}

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false)
  const codeString = String(children).replace(/\n$/, '')

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="relative group my-3 rounded-md overflow-hidden border border-white/10 bg-[#0E1116]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#14171E] border-b border-white/5 text-[11px] font-mono text-text-muted">
        <span>{className?.replace('language-', '') || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-xs font-mono overflow-x-auto text-[#E2E8F0] leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  )
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
}) => {
  return (
    <div className={cn('problem-statement prose prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !String(children).includes('\n') && !className
            if (isInline) {
              return (
                <code
                  className="font-mono text-[0.85em] bg-surface-subtle px-1.5 py-0.5 rounded text-emerald-300 border border-white/5"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return <CodeBlock className={className}>{children}</CodeBlock>
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3 border border-white/10 rounded-md">
                <table className="w-full text-xs text-left border-collapse">{children}</table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 bg-surface-subtle border-b border-white/10 text-text-primary font-medium">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="px-3 py-2 border-b border-white/5 text-text-secondary">
                {children}
              </td>
            )
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary/50 pl-3.5 my-3 text-text-secondary italic text-sm">
                {children}
              </blockquote>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

