import React, { useState } from 'react'
import { Terminal, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { TestCase } from '../../lib/api/types'
import { cn } from '../../lib/utils'

interface ConsolePanelProps {
  testCases: TestCase[]
  isRunning?: boolean
  lastRunResult?: {
    status: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compilation Error'
    results?: Array<{
      input: string
      expected: string
      actual: string
      passed: boolean
      runtime?: number
    }>
    error?: string
  } | null
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  testCases,
  isRunning = false,
  lastRunResult,
}) => {
  const [selectedCase, setSelectedCase] = useState(0)
  const [isExpanded, setIsExpanded] = useState(true)
  const [customInput, setCustomInput] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)

  const activeCase = testCases[selectedCase] || testCases[0]
  const activeRunResult = lastRunResult?.results?.[selectedCase]

  return (
    <div className="w-full bg-[#111418] border-t border-white/8 flex flex-col transition-all duration-200">
      {/* Console Header Bar */}
      <div className="h-9 px-3 bg-[#141820] border-b border-white/5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-mono font-medium text-text-secondary hover:text-text-primary focus-visible:outline-none"
          >
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span>Test Console</span>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>

          {lastRunResult && (
            <span
              className={cn(
                'ml-2 text-[11px] font-mono px-2 py-0.5 rounded border',
                lastRunResult.status === 'Accepted'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              )}
            >
              {lastRunResult.status}
            </span>
          )}
        </div>

        {/* Case tabs */}
        {isExpanded && (
          <div className="flex items-center gap-1">
            {testCases.map((_, idx) => {
              const res = lastRunResult?.results?.[idx]
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setIsCustomMode(false)
                    setSelectedCase(idx)
                  }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-mono rounded transition-colors focus-visible:outline-none',
                    !isCustomMode && selectedCase === idx
                      ? 'bg-surface-elevated text-white border border-white/10'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
                  )}
                >
                  {res && (
                    res.passed ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <X className="w-2.5 h-2.5 text-red-400" />
                    )
                  )}
                  <span>Case {idx + 1}</span>
                </button>
              )
            })}
            <button
              onClick={() => setIsCustomMode(true)}
              className={cn(
                'px-2 py-0.5 text-[11px] font-mono rounded transition-colors focus-visible:outline-none',
                isCustomMode
                  ? 'bg-surface-elevated text-white border border-white/10'
                  : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
              )}
            >
              Custom
            </button>
          </div>
        )}
      </div>

      {/* Console Content */}
      {isExpanded && (
        <div className="p-3 text-xs font-mono max-h-48 overflow-y-auto">
          {isRunning ? (
            <div className="flex items-center justify-center py-6 text-text-muted gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>Running against test cases...</span>
            </div>
          ) : isCustomMode ? (
            <div>
              <div className="text-text-muted mb-1 text-[11px]">Custom Stdin Input:</div>
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Enter standard input..."
                className="w-full h-24 bg-[#0E1116] border border-white/10 rounded p-2 text-text-primary text-xs font-mono focus:outline-none focus:border-primary/50"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-text-muted text-[11px] mb-1">Input:</div>
                <pre className="p-2 bg-[#0E1116] border border-white/8 rounded text-[#E2E8F0] overflow-x-auto whitespace-pre-wrap">
                  {activeCase?.input}
                </pre>
              </div>

              <div>
                <div className="text-text-muted text-[11px] mb-1">Expected Output:</div>
                <pre className="p-2 bg-[#0E1116] border border-white/8 rounded text-[#E2E8F0] overflow-x-auto whitespace-pre-wrap">
                  {activeCase?.output}
                </pre>
              </div>

              {activeRunResult && (
                <div>
                  <div className="text-text-muted text-[11px] mb-1 flex items-center justify-between">
                    <span>Your Output:</span>
                    <span className={activeRunResult.passed ? 'text-emerald-400' : 'text-red-400'}>
                      {activeRunResult.passed ? 'Passed ✓' : 'Mismatch ✗'}
                    </span>
                  </div>
                  <pre
                    className={cn(
                      'p-2 rounded overflow-x-auto whitespace-pre-wrap border',
                      activeRunResult.passed
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/5 border-red-500/20 text-red-300'
                    )}
                  >
                    {activeRunResult.actual}
                  </pre>
                </div>
              )}

              {lastRunResult?.error && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-red-300 text-xs">
                  <div className="font-bold mb-1">Compilation / Runtime Error:</div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px]">
                    {lastRunResult.error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

