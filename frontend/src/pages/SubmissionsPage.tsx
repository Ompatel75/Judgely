import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { History, Code, X, Copy, Check } from 'lucide-react'
import { api } from '../lib/api/client'
import { useAuthStore } from '../store/authStore'
import type { Submission } from '../lib/api/types'
import { VerdictBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { formatRuntime, formatMemory, formatTimeAgo } from '../lib/utils'

export const SubmissionsPage: React.FC = () => {
  const { user } = useAuthStore()
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ['my_submissions', user?.id],
    queryFn: () => api.getMySubmissions(),
    enabled: !!user,
  })

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 1500)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <span>Submission Records</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Historical trace of your sandboxed code executions and verdict logs.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="border border-white/8 rounded-lg overflow-hidden bg-surface shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/8 bg-[#141820] text-xs font-mono text-text-muted select-none">
                <th className="py-2.5 px-4 w-24"># ID</th>
                <th className="py-2.5 px-4">Problem</th>
                <th className="py-2.5 px-4 w-36">Verdict</th>
                <th className="py-2.5 px-4 w-24">Language</th>
                <th className="py-2.5 px-4 w-24">Runtime</th>
                <th className="py-2.5 px-4 w-24">Memory</th>
                <th className="py-2.5 px-4 w-28">Submitted</th>
                <th className="py-2.5 px-4 w-20 text-right">Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs sm:text-sm font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    Loading your submissions...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    No submissions found. Start solving problems to track your progress!
                  </td>
                </tr>
              ) : (
                submissions.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4 text-text-muted text-xs">
                      #{sub.id}
                    </td>

                    <td className="py-3 px-4 font-sans font-medium text-text-primary">
                      <Link
                        to={`/problems/${sub.problem_id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {sub.problem_title || `Problem #${sub.problem_id}`}
                      </Link>
                    </td>

                    <td className="py-3 px-4">
                      <VerdictBadge verdict={sub.verdict} />
                    </td>

                    <td className="py-3 px-4 uppercase text-xs text-text-secondary">
                      {sub.language}
                    </td>

                    <td className="py-3 px-4 text-xs text-text-secondary">
                      {formatRuntime(sub.runtime)}
                    </td>

                    <td className="py-3 px-4 text-xs text-text-secondary">
                      {formatMemory(sub.memory)}
                    </td>

                    <td className="py-3 px-4 text-xs text-text-muted">
                      {formatTimeAgo(sub.created_at)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSubmission(sub)}
                        className="h-7 px-2 text-text-muted hover:text-text-primary"
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-xs">View</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Viewer Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#111418] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 bg-[#141820]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-text-muted">
                  Submission #{selectedSubmission.id}
                </span>
                <VerdictBadge verdict={selectedSubmission.verdict} />
                <span className="text-xs font-mono uppercase text-emerald-400">
                  {selectedSubmission.language}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(selectedSubmission.code)}
                  className="h-7 px-2"
                >
                  {copiedCode ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span className="text-xs">{copiedCode ? 'Copied' : 'Copy'}</span>
                </Button>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-1 text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-[#0E1116]">
              <pre className="text-xs font-mono text-[#E2E8F0] leading-relaxed whitespace-pre-wrap">
                <code>{selectedSubmission.code}</code>
              </pre>

              {selectedSubmission.error_message && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-xs font-mono text-red-300">
                  <div className="font-bold mb-1">Execution Diagnostics:</div>
                  <pre className="whitespace-pre-wrap">{selectedSubmission.error_message}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

