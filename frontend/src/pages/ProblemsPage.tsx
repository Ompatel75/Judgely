import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, CheckCircle2, Circle, Clock, ArrowUpDown, Tag, Sparkles } from 'lucide-react'
import { api } from '../lib/api/client'
import type { Difficulty, Problem } from '../lib/api/types'
import { DifficultyBadge } from '../components/ui/Badge'
import { ProblemRowSkeleton } from '../components/ui/Skeleton'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/utils'

export const ProblemsPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'id' | 'acceptance_rate' | 'difficulty'>('id')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data: problems = [], isLoading } = useQuery<Problem[]>({
    queryKey: ['problems'],
    queryFn: () => api.getProblems(),
  })

  // Extract unique tags across problems
  const allTags = useMemo(() => {
    const set = new Set<string>()
    problems.forEach((p) => p.tags?.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [problems])

  // Filter and sort problems
  const filteredProblems = useMemo(() => {
    return problems
      .filter((p) => {
        const matchesSearch =
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
        const matchesDiff =
          selectedDifficulty === 'all' || p.difficulty.toLowerCase() === selectedDifficulty.toLowerCase()
        const matchesTag =
          selectedTag === 'all' || p.tags?.includes(selectedTag)
        return matchesSearch && matchesDiff && matchesTag
      })
      .sort((a, b) => {
        if (sortBy === 'id') {
          return sortOrder === 'asc' ? a.id - b.id : b.id - a.id
        }
        if (sortBy === 'acceptance_rate') {
          return sortOrder === 'asc'
            ? a.acceptance_rate - b.acceptance_rate
            : b.acceptance_rate - a.acceptance_rate
        }
        if (sortBy === 'difficulty') {
          const rank = { Easy: 1, Medium: 2, Hard: 3 }
          return sortOrder === 'asc'
            ? rank[a.difficulty] - rank[b.difficulty]
            : rank[b.difficulty] - rank[a.difficulty]
        }
        return 0
      })
  }, [problems, search, selectedDifficulty, selectedTag, sortBy, sortOrder])

  // Paginated slice
  const paginatedProblems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredProblems.slice(start, start + pageSize)
  }, [filteredProblems, page])

  const totalPages = Math.ceil(filteredProblems.length / pageSize) || 1

  const toggleSort = (field: 'id' | 'acceptance_rate' | 'difficulty') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <span>Problem Archive</span>
            <span className="text-xs font-mono font-normal text-text-muted bg-surface-subtle px-2 py-0.5 rounded border border-white/5">
              {filteredProblems.length} available
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Solve curated competitive programming problems with instant sandboxed evaluation & AI hints.
          </p>
        </div>

        {/* Quick info banner */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Eager Hints pre-cached in &lt; 8ms for every problem</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 bg-surface p-3 rounded-lg border border-white/8 shadow-subtle">
        {/* Search */}
        <div className="w-full md:w-80">
          <Input
            placeholder="Search problems, tags..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            icon={<Search className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Difficulty buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', 'Easy', 'Medium', 'Hard'].map((diff) => (
            <button
              key={diff}
              onClick={() => {
                setSelectedDifficulty(diff)
                setPage(1)
              }}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-mono transition-colors focus-visible:outline-none',
                selectedDifficulty === diff
                  ? 'bg-surface-elevated text-white border border-white/15'
                  : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
              )}
            >
              {diff === 'all' ? 'All Difficulties' : diff}
            </button>
          ))}
        </div>

        {/* Tag filter dropdown */}
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-text-muted" />
          <select
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value)
              setPage(1)
            }}
            aria-label="Filter by Topic Tag"
            className="bg-surface-subtle border border-white/10 rounded px-2.5 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-primary/50 cursor-pointer"
          >
            <option value="all">All Topics</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Problem Table */}
      <div className="border border-white/8 rounded-lg overflow-hidden bg-surface shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/8 bg-[#141820] text-xs font-mono text-text-muted select-none">
                <th className="py-2.5 px-4 w-12 text-center">Status</th>
                <th className="py-2.5 px-4">
                  <button
                    onClick={() => toggleSort('id')}
                    className="flex items-center gap-1 hover:text-text-primary focus-visible:outline-none"
                  >
                    <span># Title</span>
                    <ArrowUpDown className="w-3 h-3 text-text-muted" />
                  </button>
                </th>
                <th className="py-2.5 px-4 w-28">
                  <button
                    onClick={() => toggleSort('difficulty')}
                    className="flex items-center gap-1 hover:text-text-primary focus-visible:outline-none"
                  >
                    <span>Difficulty</span>
                    <ArrowUpDown className="w-3 h-3 text-text-muted" />
                  </button>
                </th>
                <th className="py-2.5 px-4 w-32 hidden md:table-cell">
                  <button
                    onClick={() => toggleSort('acceptance_rate')}
                    className="flex items-center gap-1 hover:text-text-primary focus-visible:outline-none"
                  >
                    <span>Acceptance</span>
                    <ArrowUpDown className="w-3 h-3 text-text-muted" />
                  </button>
                </th>
                <th className="py-2.5 px-4 hidden lg:table-cell">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
              {isLoading ? (
                <>
                  <ProblemRowSkeleton />
                  <ProblemRowSkeleton />
                  <ProblemRowSkeleton />
                  <ProblemRowSkeleton />
                  <ProblemRowSkeleton />
                </>
              ) : paginatedProblems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-muted font-mono text-xs">
                    No problems match your current search criteria.
                  </td>
                </tr>
              ) : (
                paginatedProblems.map((prob) => {
                  return (
                    <tr
                      key={prob.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Solved Status Indicator */}
                      <td className="py-3 px-4 text-center">
                        {prob.status === 'solved' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : prob.status === 'attempted' ? (
                          <Clock className="w-4 h-4 text-amber-400 mx-auto" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-white/10 mx-auto group-hover:text-white/20 transition-colors" />
                        )}
                      </td>

                      {/* Title & ID */}
                      <td className="py-3 px-4">
                        <Link
                          to={`/problems/${prob.id}`}
                          className="font-medium text-text-primary hover:text-primary transition-colors flex items-center gap-2"
                        >
                          <span className="font-mono text-xs text-text-muted">
                            {prob.id}.
                          </span>
                          <span className="tracking-tight">{prob.title}</span>
                        </Link>
                      </td>

                      {/* Difficulty */}
                      <td className="py-3 px-4">
                        <DifficultyBadge difficulty={prob.difficulty} />
                      </td>

                      {/* Acceptance rate */}
                      <td className="py-3 px-4 hidden md:table-cell font-mono text-xs text-text-secondary">
                        {prob.acceptance_rate.toFixed(1)}%
                      </td>

                      {/* Tags */}
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {prob.tags?.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-surface-subtle text-text-muted border border-white/5"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 bg-[#141820] border-t border-white/8 flex items-center justify-between text-xs font-mono text-text-muted">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

