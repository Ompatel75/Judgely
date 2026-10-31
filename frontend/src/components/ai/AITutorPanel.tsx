import React, { useState } from 'react'
import { Sparkles, Send, Lightbulb, Compass, Bug, Bot, User, RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import { MarkdownRenderer } from '../math/MarkdownRenderer'
import { api } from '../../lib/api/client'
import type { AIMessage } from '../../lib/api/types'
import { cn } from '../../lib/utils'

interface AITutorPanelProps {
  problemId: number
  code?: string
  lastSubmissionVerdict?: string
  lastSubmissionError?: string
}

export const AITutorPanel: React.FC<AITutorPanelProps> = ({
  problemId,
  code,
  lastSubmissionVerdict,
  lastSubmissionError,
}) => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `Hello! I am your **Judgely AI Tutor** (powered by Gemini Flash 3.8).

I am designed to guide you through competitive programming with **progressive nudges and algorithmic intuition** without spoiling full solutions outright.

How can I help you tackle this problem?`,
      timestamp: new Date().toISOString(),
    },
  ])

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Send a custom message
  const handleSend = async (customPrompt?: string, promptType: 'hint' | 'approach' | 'bug_detect' = 'hint') => {
    const textToSend = customPrompt || input.trim()
    if (!textToSend || isLoading) return

    const userMsg: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!customPrompt) setInput('')
    setIsLoading(true)

    // Temporary placeholder assistant message
    const botMsgId = `bot-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: new Date().toISOString(),
      },
    ])

    try {
      // Call AI Hint API
      const res = await api.requestAIHint({
        problem_id: problemId,
        code,
        prompt_type: promptType,
      })

      const fullContent = res.hint || 'No hint available for this problem yet.'

      // Stream words smoothly for interactive feel
      const words = fullContent.split(' ')
      let currentContent = ''

      for (let i = 0; i < words.length; i++) {
        currentContent += (i === 0 ? '' : ' ') + words[i]
        const temp = currentContent
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? { ...m, content: temp, isStreaming: i < words.length - 1 }
              : m
          )
        )
        // 15ms per chunk for natural fluid reading
        await new Promise((r) => setTimeout(r, 15))
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                content:
                  'Unable to reach AI tutor engine. Please check your connectivity or try again in a few seconds.',
                isStreaming: false,
              }
            : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickAction = (action: 'hint' | 'approach' | 'bug') => {
    if (action === 'hint') {
      handleSend('Give me a small nudge hint for this problem without giving away the full solution.', 'hint')
    } else if (action === 'approach') {
      handleSend('Explain the optimal high-level approach and time complexity needed.', 'approach')
    } else if (action === 'bug') {
      const prompt = lastSubmissionVerdict
        ? `My submission resulted in ${lastSubmissionVerdict}${lastSubmissionError ? `: ${lastSubmissionError}` : ''}. Can you help diagnose what corner cases or algorithmic traps I might have fallen into?`
        : 'Can you analyze my code for potential bugs, overflow risks, or edge cases?'
      handleSend(prompt, 'bug_detect')
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: 'init-reset',
        role: 'assistant',
        content: 'Chat reset. What would you like to explore next?',
        timestamp: new Date().toISOString(),
      },
    ])
  }

  return (
    <div className="flex flex-col h-full bg-[#0E1116] border border-white/8 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="h-10 px-3 bg-[#111418] border-b border-white/8 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-xs font-mono font-semibold text-text-primary">
            AI Tutor & Assistant
          </span>
          <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
            Socratic Mode
          </span>
        </div>

        <button
          onClick={handleClearChat}
          className="text-text-muted hover:text-text-primary p-1 rounded transition-colors focus-visible:outline-none"
          title="Clear conversation"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Quick Action Chips */}
      <div className="px-3 py-2 bg-[#141820] border-b border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickAction('hint')}
          disabled={isLoading}
          className="text-[11px] h-6 px-2 gap-1 text-emerald-400 hover:text-emerald-300 border-emerald-500/20 bg-emerald-500/5 whitespace-nowrap"
        >
          <Lightbulb className="w-3 h-3" />
          Give me a hint
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickAction('approach')}
          disabled={isLoading}
          className="text-[11px] h-6 px-2 gap-1 text-sky-400 hover:text-sky-300 border-sky-500/20 bg-sky-500/5 whitespace-nowrap"
        >
          <Compass className="w-3 h-3" />
          Explain approach
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickAction('bug')}
          disabled={isLoading}
          className="text-[11px] h-6 px-2 gap-1 text-rose-400 hover:text-rose-300 border-rose-500/20 bg-rose-500/5 whitespace-nowrap"
        >
          <Bug className="w-3 h-3" />
          Why is my solution wrong?
        </Button>
      </div>

      {/* Message Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((m) => {
          const isUser = m.role === 'user'
          return (
            <div
              key={m.id}
              className={cn(
                'flex gap-2.5 max-w-[92%]',
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[11px] font-mono mt-0.5',
                  isUser
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-surface-elevated text-emerald-400 border border-white/10'
                )}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Message Bubble */}
              <div
                className={cn(
                  'rounded-lg p-3 text-xs leading-relaxed border',
                  isUser
                    ? 'bg-primary/10 border-primary/20 text-white'
                    : 'bg-[#14171E] border-white/8 text-[#D1D5DB]'
                )}
              >
                {m.content ? (
                  <MarkdownRenderer content={m.content} />
                ) : (
                  <div className="flex items-center gap-1.5 py-1 text-text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono">Formulating hint...</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-[#111418] border-t border-white/8">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI tutor (e.g. 'How can I optimize the space complexity?')..."
            disabled={isLoading}
            className="flex-1 bg-[#171B21] border border-white/10 rounded-md px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:shadow-emerald-focus"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!input.trim() || isLoading}
            isLoading={isLoading}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  )
}

