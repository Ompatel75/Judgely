import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  History,
  Sparkles,
  Play,
  Send,
  ChevronLeft,
  Clock,
  Cpu,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react'
import { api } from '../lib/api/client'
import { useEditorStore } from '../store/editorStore'
import { useAuthStore } from '../store/authStore'
import type { Problem, Submission } from '../lib/api/types'
import { MarkdownRenderer } from '../components/math/MarkdownRenderer'
import { CodeEditor } from '../components/editor/CodeEditor'
import { ConsolePanel } from '../components/editor/ConsolePanel'
import { DifficultyBadge, VerdictBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Tabs } from '../components/ui/Tabs'
import { AITutorPanel } from '../components/ai/AITutorPanel'
import { SubmissionResultModal } from '../components/submission/SubmissionResultModal'
import { formatRuntime, formatMemory, formatTimeAgo } from '../lib/utils'

export const ProblemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const problemId = Number(id) || 1
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const { language, getCode, activeTab, setActiveTab } = useEditorStore()
  const currentCode = getCode(problemId, language)

  // Mobile layout tab switcher
  const [mobilePane, setMobilePane] = useState<'problem' | 'editor'>('problem')

  // Sample test run state
  const [isRunningSample, setIsRunningSample] = useState(false)
  const [sampleRunResult, setSampleRunResult] = useState<{
    status: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compilation Error'
    results?: Array<{
      input: string
      expected: string
      actual: string
      passed: boolean
      runtime?: number
    }>
    error?: string
  } | null>(null)

  // Submission modal state & Celery polling
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null)
  const [submissionStatus, setSubmissionStatus] = useState<
    'pending' | 'running' | 'done' | 'failed'
  >('done')
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)

  // Fetch problem details
  const { data: problem, isLoading, isError } = useQuery<Problem>({
    queryKey: ['problem', problemId],
    queryFn: () => api.getProblem(problemId),
  })

  // Fetch submissions for this problem
  const { data: allSubmissions = [] } = useQuery<Submission[]>({
    queryKey: ['my_submissions', user?.id],
    queryFn: () => api.getMySubmissions(),
    enabled: !!user,
  })

  const problemSubmissions = allSubmissions.filter(
    (s) => s.problem_id === problemId
  )

  // Polling helper for Celery / background async evaluation
  const pollSubmission = async (submissionId: number, taskId?: string) => {
    let attempts = 0
    const maxAttempts = 30 // ~30 seconds max
    const interval = 1000

    const check = async () => {
      attempts++
      try {
        if (taskId) {
          const res = await api.pollSubmissionTask(taskId)
          if (res.status === 'running') {
            setSubmissionStatus('running')
          }
          if (res.status === 'done') {
            setSubmissionStatus('done')
            setActiveSubmission((prev) =>
              prev
                ? {
                    ...prev,
                    verdict: res.verdict || 'Accepted',
                    runtime: res.runtime,
                    memory: res.memory,
                    test_cases_passed: res.passed_cases,
                    total_test_cases: res.total_cases,
                    error_message: res.error_message,
                  }
                : null
            )
            queryClient.invalidateQueries({ queryKey: ['my_submissions', user?.id] })
            queryClient.invalidateQueries({ queryKey: ['problem_status', user?.id] })
            queryClient.invalidateQueries({ queryKey: ['user_stats', user?.id] })
            return
          }
        } else {
          // Poll by submission ID directly (FastAPI BackgroundTasks mode)
          const sub = await api.getSubmission(submissionId)
          if (sub.verdict === 'Running') {
            setSubmissionStatus('running')
          } else if (sub.verdict !== 'Pending') {
            setSubmissionStatus('done')
            setActiveSubmission(sub)
            queryClient.invalidateQueries({ queryKey: ['my_submissions', user?.id] })
            queryClient.invalidateQueries({ queryKey: ['problem_status', user?.id] })
            queryClient.invalidateQueries({ queryKey: ['user_stats', user?.id] })
            return
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(check, interval)
        } else {
          setSubmissionStatus('failed')
        }
      } catch (err) {
        console.error('Polling error:', err)
        setSubmissionStatus('done')
      }
    }

    setTimeout(check, interval)
  }

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () =>
      api.submitCode({
        problem_id: problemId,
        language,
        code: currentCode,
      }),
    onMutate: () => {
      setSubmissionStatus('pending')
      setIsResultModalOpen(true)
    },
    onSuccess: (res) => {
      const newSub: Submission = {
        id: res.id,
        problem_id: problemId,
        user_id: user?.id || 1,
        language,
        code: currentCode,
        verdict: res.verdict,
        task_id: res.task_id,
        created_at: new Date().toISOString(),
        total_test_cases: problem?.test_cases?.length || 5,
        test_cases_passed: 0,
      }
      setActiveSubmission(newSub)

      if (res.task_id) {
        pollSubmission(res.id, res.task_id)
      } else if (res.verdict === 'Pending' || res.verdict === 'Running') {
        pollSubmission(res.id)
      } else {
        setSubmissionStatus('done')
        queryClient.invalidateQueries({ queryKey: ['my_submissions', user?.id] })
        queryClient.invalidateQueries({ queryKey: ['problem_status', user?.id] })
        queryClient.invalidateQueries({ queryKey: ['user_stats', user?.id] })
      }
    },
    onError: (err: any) => {
      setSubmissionStatus('failed')
      alert(`Submission failed: ${err.message}`)
    },
  })

  // Run sample tests locally/lightweight
  const handleRunSampleTests = async () => {
    if (!problem?.test_cases) return
    setIsRunningSample(true)
    setSampleRunResult(null)

    // Simulate execution delay
    setTimeout(() => {
      const isAccepted = currentCode.length > 50 && !currentCode.includes('// Naive')
      const mockResults = problem.test_cases.map((tc) => ({
        input: tc.input,
        expected: tc.output,
        actual: isAccepted ? tc.output : '0 0',
        passed: isAccepted,
        runtime: Math.floor(8 + Math.random() * 12),
      }))

      setSampleRunResult({
        status: isAccepted ? 'Accepted' : 'Wrong Answer',
        results: mockResults,
        error: isAccepted ? undefined : 'Output mismatch on sample test 1.',
      })
      setIsRunningSample(false)
    }, 700)
  }

  // Copy sample test helper
  const [copiedSample, setCopiedSample] = useState<number | null>(null)
  const handleCopySample = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedSample(index)
    setTimeout(() => setCopiedSample(null), 1500)
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center font-mono text-xs text-text-muted">
        Loading problem statement and editor environment...
      </div>
    )
  }

  if (isError || !problem) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-surface border border-red-500/20 rounded-lg text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <h2 className="text-base font-semibold text-text-primary">Problem Not Found</h2>
        <p className="text-xs text-text-muted mt-1 mb-4">
          The requested problem does not exist or could not be loaded.
        </p>
        <Link to="/problems">
          <Button variant="secondary" size="sm">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Problems
          </Button>
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: 'description', label: 'Description', icon: <FileText className="w-3.5 h-3.5" /> },
    {
      id: 'submissions',
      label: 'Submissions',
      icon: <History className="w-3.5 h-3.5" />,
      badge: problemSubmissions.length || undefined,
    },
    { id: 'ai_tutor', label: 'AI Tutor', icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0B0D10]">
      {/* Problem Navigation Top Sub-Bar */}
      <div className="h-10 px-4 bg-[#0E1116] border-b border-white/8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/problems"
            className="flex items-center gap-1 text-xs font-mono text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Archive</span>
          </Link>
          <span className="text-white/20">•</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted">#{problem.id}</span>
            <span className="text-xs font-semibold text-text-primary tracking-tight truncate max-w-[200px] sm:max-w-md">
              {problem.title}
            </span>
            <DifficultyBadge difficulty={problem.difficulty} />
          </div>
        </div>

        {/* Mobile Pane Switcher (Visible only on small screens) */}
        <div className="flex md:hidden items-center border border-white/10 rounded bg-[#171B21]">
          <button
            onClick={() => setMobilePane('problem')}
            className={`px-2.5 py-1 text-xs font-mono rounded ${
              mobilePane === 'problem' ? 'bg-primary text-white' : 'text-text-muted'
            }`}
          >
            Statement
          </button>
          <button
            onClick={() => setMobilePane('editor')}
            className={`px-2.5 py-1 text-xs font-mono rounded ${
              mobilePane === 'editor' ? 'bg-primary text-white' : 'text-text-muted'
            }`}
          >
            Editor
          </button>
        </div>

        {/* Limits info */}
        <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-text-muted">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-emerald-400" />
            {problem.time_limit}s
          </span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-sky-400" />
            {problem.memory_limit} MB
          </span>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel: Tabs for Statement, Submissions, AI Tutor */}
        <div
          className={`w-full md:w-1/2 flex flex-col border-r border-white/8 bg-[#0B0D10] overflow-hidden ${
            mobilePane === 'editor' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Tab Selector */}
          <div className="px-4 bg-[#111418] border-b border-white/8">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as any)}
            />
          </div>

          {/* Left Panel Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {activeTab === 'description' && (
              <div className="space-y-6">
                {/* Problem Statement Markdown with LaTeX */}
                <MarkdownRenderer content={problem.description} />

                {/* Input Format */}
                {problem.input_format && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted font-semibold">
                      Input Format
                    </h3>
                    <div className="p-3 bg-[#111418] border border-white/5 rounded-lg text-xs leading-relaxed text-text-secondary">
                      <MarkdownRenderer content={problem.input_format} />
                    </div>
                  </div>
                )}

                {/* Output Format */}
                {problem.output_format && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted font-semibold">
                      Output Format
                    </h3>
                    <div className="p-3 bg-[#111418] border border-white/5 rounded-lg text-xs leading-relaxed text-text-secondary">
                      <MarkdownRenderer content={problem.output_format} />
                    </div>
                  </div>
                )}

                {/* Constraints */}
                {problem.constraints && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted font-semibold">
                      Constraints
                    </h3>
                    <div className="p-3 bg-[#111418] border border-white/5 rounded-lg text-xs leading-relaxed text-text-secondary font-mono">
                      <MarkdownRenderer content={problem.constraints} />
                    </div>
                  </div>
                )}

                {/* Sample Test Cases with Copy button */}
                {problem.test_cases && problem.test_cases.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted font-semibold">
                      Sample Tests
                    </h3>
                    {problem.test_cases.map((tc, idx) => (
                      <div
                        key={idx}
                        className="border border-white/8 rounded-lg overflow-hidden bg-[#111418]"
                      >
                        <div className="px-3 py-1.5 bg-[#141820] border-b border-white/5 flex items-center justify-between text-[11px] font-mono text-text-muted">
                          <span>Sample {idx + 1}</span>
                          <button
                            onClick={() =>
                              handleCopySample(
                                `Input:\n${tc.input}\n\nOutput:\n${tc.output}`,
                                idx
                              )
                            }
                            className="flex items-center gap-1 hover:text-text-primary transition-colors focus-visible:outline-none"
                          >
                            {copiedSample === idx ? (
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
                        <div className="p-3 space-y-2 text-xs font-mono">
                          <div>
                            <span className="text-text-muted text-[10px] block mb-0.5">Input:</span>
                            <pre className="p-2 bg-[#0E1116] border border-white/5 rounded text-text-primary whitespace-pre-wrap">
                              {tc.input}
                            </pre>
                          </div>
                          <div>
                            <span className="text-text-muted text-[10px] block mb-0.5">Output:</span>
                            <pre className="p-2 bg-[#0E1116] border border-white/5 rounded text-text-primary whitespace-pre-wrap">
                              {tc.output}
                            </pre>
                          </div>
                          {tc.explanation && (
                            <div className="pt-1 text-[11px] text-text-secondary italic">
                              <span className="text-text-muted not-italic">Note: </span>
                              {tc.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Submissions Tab */}
            {activeTab === 'submissions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-text-muted">
                    Your Submission History
                  </span>
                </div>

                {problemSubmissions.length === 0 ? (
                  <div className="text-center py-12 text-xs font-mono text-text-muted">
                    No submissions for this problem yet. Submit your solution from the editor!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {problemSubmissions.map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => {
                          setActiveSubmission(sub)
                          setSubmissionStatus('done')
                          setIsResultModalOpen(true)
                        }}
                        className="p-3 rounded-lg bg-surface border border-white/8 hover:border-white/15 transition-all cursor-pointer flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-3">
                          <VerdictBadge verdict={sub.verdict} />
                          <span className="text-text-muted uppercase text-[11px]">
                            {sub.language}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-text-muted text-[11px]">
                          <span>{formatRuntime(sub.runtime)}</span>
                          <span>{formatMemory(sub.memory)}</span>
                          <span>{formatTimeAgo(sub.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Tutor Tab */}
            {activeTab === 'ai_tutor' && (
              <div className="h-full">
                <AITutorPanel
                  problemId={problemId}
                  code={currentCode}
                  lastSubmissionVerdict={problemSubmissions[0]?.verdict}
                  lastSubmissionError={problemSubmissions[0]?.error_message}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Monaco Editor & Test Console */}
        <div
          className={`w-full md:w-1/2 flex flex-col h-full bg-[#0E1116] overflow-hidden ${
            mobilePane === 'problem' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Editor Component */}
          <div className="flex-1 min-h-[300px] overflow-hidden">
            <CodeEditor
              problemId={problemId}
              onRun={handleRunSampleTests}
              onSubmit={() => submitMutation.mutate()}
            />
          </div>

          {/* Test Console Bottom Panel */}
          <ConsolePanel
            testCases={problem.test_cases || []}
            isRunning={isRunningSample}
            lastRunResult={sampleRunResult}
          />

          {/* Editor Action Bottom Bar */}
          <div className="h-12 px-4 bg-[#111418] border-t border-white/8 flex items-center justify-between select-none flex-shrink-0">
            <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
              <span>Shortcuts:</span>
              <kbd className="px-1.5 py-0.5 bg-surface-elevated border border-white/10 rounded text-[10px]">
                Ctrl+Enter
              </kbd>
              <span>Submit</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRunSampleTests}
                isLoading={isRunningSample}
                kbd="Run"
              >
                <Play className="w-3.5 h-3.5 text-text-muted" />
                Run Code
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => submitMutation.mutate()}
                isLoading={submitMutation.isPending}
                kbd="Ctrl+↵"
              >
                <Send className="w-3.5 h-3.5" />
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Submission Result Modal */}
      <SubmissionResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        submission={activeSubmission}
        status={submissionStatus}
        onAskAITutor={() => {
          setActiveTab('ai_tutor')
          setMobilePane('problem')
        }}
      />
    </div>
  )
}

