import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2, Save, ChevronRight } from 'lucide-react'
import { api } from '../lib/api/client'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { queryClient } from '../lib/queryClient'

interface TestCaseEntry {
  input_data: string
  expected_output: string
  is_hidden: boolean
}

export const AddProblemPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Redirect non-admins immediately
  if (!user?.is_admin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-text-secondary text-sm">You do not have permission to create problems.</p>
      </div>
    )
  }

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium')
  const [tags, setTags] = useState('')
  const [timeLimit, setTimeLimit] = useState('1.0')
  const [memoryLimit, setMemoryLimit] = useState('256')
  const [testCases, setTestCases] = useState<TestCaseEntry[]>([
    { input_data: '', expected_output: '', is_hidden: false },
  ])
  const [formError, setFormError] = useState<string | null>(null)

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      // 1. Create the problem
      const prob = await api.createProblem({
        title: title.trim(),
        description: description.trim(),
        difficulty,
        tags: tags.trim(),
        time_limit: parseFloat(timeLimit) || 1.0,
        memory_limit: parseInt(memoryLimit) || 256,
      })

      // 2. Add test cases one by one
      for (const tc of testCases) {
        if (tc.input_data.trim() || tc.expected_output.trim()) {
          await api.addTestCase(prob.id, {
            input_data: tc.input_data,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden,
          })
        }
      }

      return prob
    },
    onSuccess: (prob) => {
      queryClient.invalidateQueries({ queryKey: ['problems'] })
      navigate(`/problems/${prob.id}`)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!title.trim()) return setFormError('Title is required.')
    if (!description.trim()) return setFormError('Description is required.')
    if (parseFloat(timeLimit) <= 0) return setFormError('Time limit must be positive.')
    if (parseInt(memoryLimit) <= 0) return setFormError('Memory limit must be positive.')

    try {
      await mutateAsync()
    } catch (err: any) {
      setFormError(err.message || 'Failed to create problem.')
    }
  }

  const addTestCase = () =>
    setTestCases((prev) => [...prev, { input_data: '', expected_output: '', is_hidden: true }])

  const removeTestCase = (i: number) =>
    setTestCases((prev) => prev.filter((_, idx) => idx !== i))

  const updateTC = (i: number, field: keyof TestCaseEntry, value: string | boolean) =>
    setTestCases((prev) => prev.map((tc, idx) => (idx === i ? { ...tc, [field]: value } : tc)))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-text-muted text-xs font-mono">
        <button onClick={() => navigate('/problems')} className="hover:text-text-primary transition-colors">
          Problems
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-text-primary">New Problem</span>
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">Create Problem</h1>
        <p className="text-sm text-text-secondary mt-1">Fill in the problem details. Test cases can be added after saving too.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-400">
            {formError}
          </div>
        )}

        {/* Basic Info */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary border-b border-white/8 pb-2">Basic Information</h2>

          <div>
            <label className="block text-xs font-mono text-text-muted mb-1.5">Title *</label>
            <Input
              placeholder="e.g. Two Sum"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Difficulty */}
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1.5">Difficulty *</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                className="w-full bg-surface-subtle border border-white/10 rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {/* Time limit */}
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1.5">Time Limit (s)</label>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
              />
            </div>

            {/* Memory limit */}
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1.5">Memory Limit (MB)</label>
              <Input
                type="number"
                min="16"
                step="16"
                value={memoryLimit}
                onChange={(e) => setMemoryLimit(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-text-muted mb-1.5">
              Tags <span className="text-text-muted/60">(comma-separated)</span>
            </label>
            <Input
              placeholder="array, hash-table, two-pointers"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </Card>

        {/* Description */}
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary border-b border-white/8 pb-2">
            Problem Statement *
            <span className="text-text-muted font-normal text-[11px] ml-2">(Markdown + LaTeX supported)</span>
          </h2>
          <textarea
            className="w-full h-64 bg-[#0B0D10] border border-white/10 rounded-md px-3 py-2.5 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            placeholder={`Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.\n\n**Constraints:**\n- $2 \\le n \\le 10^4$\n- $-10^9 \\le \\text{nums}[i] \\le 10^9$\n\n**Input format:** ...\n**Output format:** ...`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </Card>

        {/* Test Cases */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-2">
            <h2 className="text-sm font-semibold text-text-primary">Test Cases</h2>
            <button
              type="button"
              onClick={addTestCase}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-mono transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add case
            </button>
          </div>

          {testCases.map((tc, i) => (
            <div key={i} className="space-y-2 p-3 bg-surface-subtle rounded-md border border-white/6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono text-text-muted">Test Case #{i + 1}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tc.is_hidden}
                      onChange={(e) => updateTC(i, 'is_hidden', e.target.checked)}
                      className="accent-primary"
                    />
                    Hidden
                  </label>
                  {testCases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTestCase(i)}
                      className="text-red-400/60 hover:text-red-400 transition-colors"
                      aria-label="Remove test case"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono text-text-muted mb-1">Input</label>
                  <textarea
                    className="w-full h-20 bg-[#0B0D10] border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    placeholder="1 2 3&#10;target: 5"
                    value={tc.input_data}
                    onChange={(e) => updateTC(i, 'input_data', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted mb-1">Expected Output</label>
                  <textarea
                    className="w-full h-20 bg-[#0B0D10] border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    placeholder="0 1"
                    value={tc.expected_output}
                    onChange={(e) => updateTC(i, 'expected_output', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate('/problems')}
            className="text-xs text-text-muted hover:text-text-primary font-mono transition-colors px-3 py-2"
          >
            Cancel
          </button>
          <Button type="submit" variant="primary" size="md" isLoading={isPending} className="gap-2">
            <Save className="w-4 h-4" />
            {isPending ? 'Creating…' : 'Create Problem'}
          </Button>
        </div>
      </form>
    </div>
  )
}

