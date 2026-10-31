import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, XCircle, Clock, Cpu, Sparkles } from 'lucide-react'
import type { Submission } from '../../lib/api/types'
import { VerdictBadge } from '../ui/Badge'
import { formatRuntime, formatMemory } from '../../lib/utils'
import { Button } from '../ui/Button'

interface SubmissionResultModalProps {
  isOpen: boolean
  onClose: () => void
  submission: Submission | null
  status: 'pending' | 'running' | 'done' | 'failed'
  onAskAITutor?: () => void
}

export const SubmissionResultModal: React.FC<SubmissionResultModalProps> = ({
  isOpen,
  onClose,
  submission,
  status,
  onAskAITutor,
}) => {
  if (!isOpen || !submission) return null

  const isAccepted = submission.verdict === 'Accepted'
  const isPending = status === 'pending' || status === 'running' || submission.verdict === 'Pending' || submission.verdict === 'Running'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-[#111418] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#141820]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-text-muted">
                Submission #{submission.id}
              </span>
              <span className="text-white/20">•</span>
              <span className="text-xs font-mono uppercase text-emerald-400">
                {submission.language}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary p-1 rounded-md transition-colors focus-visible:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Status progression bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-text-muted">
                <span className={status === 'pending' || status === 'running' || status === 'done' ? 'text-emerald-400' : ''}>
                  1. Queued (Celery)
                </span>
                <span className={status === 'running' || status === 'done' ? 'text-emerald-400' : ''}>
                  2. Sandboxed Running
                </span>
                <span className={status === 'done' ? 'text-emerald-400 font-bold' : ''}>
                  3. Verdict
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#1C2028] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: '15%' }}
                  animate={{
                    width:
                      status === 'pending'
                        ? '33%'
                        : status === 'running'
                        ? '66%'
                        : '100%',
                  }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            {/* Verdict Display */}
            <div className="text-center py-4">
              {isPending ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin mx-auto" />
                  <div className="text-sm font-mono text-text-secondary">
                    Evaluating solution in Docker sandbox...
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <VerdictBadge
                      verdict={submission.verdict}
                      className="text-sm px-4 py-1"
                    />
                  </div>
                  {isAccepted && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-emerald-400/80 font-mono"
                    >
                      All test cases passed. Excellent work!
                    </motion.p>
                  )}
                </div>
              )}
            </div>

            {/* Stats Metrics (Runtime & Memory) */}
            {!isPending && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#171B21] border border-white/5 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center text-text-muted">
                    <Clock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted font-mono">Runtime</div>
                    <div className="text-sm font-mono font-medium text-text-primary">
                      {formatRuntime(submission.runtime)}
                    </div>
                  </div>
                </div>

                <div className="bg-[#171B21] border border-white/5 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center text-text-muted">
                    <Cpu className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted font-mono">Memory</div>
                    <div className="text-sm font-mono font-medium text-text-primary">
                      {formatMemory(submission.memory)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Test cases passed count */}
            {!isPending && submission.total_test_cases && (
              <div className="bg-[#171B21] border border-white/5 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-text-muted">Test Cases Passed:</span>
                  <span className="text-text-primary font-bold">
                    {submission.test_cases_passed || 0} / {submission.total_test_cases}
                  </span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: submission.total_test_cases }).map((_, i) => {
                    const isPassed = i < (submission.test_cases_passed || 0)
                    return (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-sm ${
                          isPassed
                            ? 'bg-emerald-500/80'
                            : 'bg-red-500/70'
                        }`}
                        title={`Test case #${i + 1}: ${isPassed ? 'Passed' : 'Failed'}`}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Error Message if failed */}
            {!isPending && submission.error_message && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-mono text-red-300">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>Execution Output:</span>
                </div>
                <pre className="whitespace-pre-wrap text-[11px]">
                  {submission.error_message}
                </pre>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-white/8 bg-[#141820] flex items-center justify-between">
            {!isAccepted && onAskAITutor && (
              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  onClose()
                  onAskAITutor()
                }}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Ask AI Tutor why it failed
              </Button>
            )}
            <div className="ml-auto">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

