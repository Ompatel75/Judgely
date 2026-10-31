import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Flame,
  Trophy,
  CheckCircle2,
  XCircle,
  Calendar,
  Activity,
} from 'lucide-react'
import { api } from '../lib/api/client'
import { useAuthStore } from '../store/authStore'
import { Card } from '../components/ui/Card'
import { VerdictBadge } from '../components/ui/Badge'
import { formatRuntime, formatTimeAgo } from '../lib/utils'
import type { UserStats, Submission } from '../lib/api/types'

export const ProfilePage: React.FC = () => {
  const { user } = useAuthStore()

  const { data: stats, isLoading } = useQuery<UserStats>({
    queryKey: ['user_stats', user?.id],
    queryFn: () => api.getUserStats(),
    enabled: !!user,
  })

  const { data: recentSubmissions = [] } = useQuery<Submission[]>({
    queryKey: ['my_submissions', user?.id],
    queryFn: () => api.getMySubmissions(),
    enabled: !!user,
  })

  // Format heatmap grid: 52 weeks x 7 days
  const heatmapCells = React.useMemo(() => {
    if (!stats?.submissions_by_date) return []

    const days: Array<{ date: string; count: number; level: number }> = []
    const dates = Object.keys(stats.submissions_by_date).sort()

    dates.forEach((dateStr) => {
      const count = stats.submissions_by_date[dateStr] || 0
      let level = 0
      if (count > 0 && count <= 1) level = 1
      else if (count > 1 && count <= 3) level = 2
      else if (count > 3 && count <= 5) level = 3
      else if (count > 5) level = 4

      days.push({ date: dateStr, count, level })
    })

    return days
  }, [stats])

  if (isLoading || !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center text-xs font-mono text-text-muted">
        Loading engineer profile telemetry...
      </div>
    )
  }

  const easyPct = Math.round((stats.easy_solved / (stats.total_easy || 1)) * 100)
  const medPct = Math.round((stats.medium_solved / (stats.total_medium || 1)) * 100)
  const hardPct = Math.round((stats.hard_solved / (stats.total_hard || 1)) * 100)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface border border-white/8 rounded-xl shadow-subtle">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono text-xl font-bold">
            {user?.username ? user.username.slice(0, 1).toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                {user?.username || 'User Profile'}
              </h1>
              {user?.ranking !== undefined && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Rank #{user.ranking}
                </span>
              )}
            </div>
            {user?.created_at && (
              <p className="text-xs text-text-muted font-mono mt-0.5">
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Streak and Stats Chips */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141820] border border-white/8">
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <div>
              <div className="text-[10px] uppercase font-mono text-text-muted">Streak</div>
              <div className="text-sm font-mono font-bold text-text-primary">
                {stats.current_streak} days
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141820] border border-white/8">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] uppercase font-mono text-text-muted">Solved</div>
              <div className="text-sm font-mono font-bold text-emerald-400">
                {stats.total_solved}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Easy */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 font-semibold uppercase">Easy</span>
            <span className="text-text-muted">
              {stats.easy_solved} / {stats.total_easy} ({easyPct}%)
            </span>
          </div>
          <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${easyPct}%` }}
            />
          </div>
        </Card>

        {/* Medium */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-amber-400 font-semibold uppercase">Medium</span>
            <span className="text-text-muted">
              {stats.medium_solved} / {stats.total_medium} ({medPct}%)
            </span>
          </div>
          <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${medPct}%` }}
            />
          </div>
        </Card>

        {/* Hard */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-rose-400 font-semibold uppercase">Hard</span>
            <span className="text-text-muted">
              {stats.hard_solved} / {stats.total_hard} ({hardPct}%)
            </span>
          </div>
          <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${hardPct}%` }}
            />
          </div>
        </Card>
      </div>

      {/* GitHub-style Submission Heatmap */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Submission Heatmap</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted">
            <span>Less</span>
            <span className="w-2.5 h-2.5 rounded-sm bg-[#171B21] border border-white/5" />
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-950 border border-emerald-900" />
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-700" />
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-300" />
            <span>More</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto pb-2">
          {heatmapCells.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-text-muted">
              No submission activity recorded yet.
            </div>
          ) : (
            <div className="inline-grid grid-flow-col grid-rows-7 gap-1">
              {heatmapCells.map((day, idx) => {
                const bgColors = [
                  'bg-[#171B21] border border-white/5',
                  'bg-emerald-950/80 border border-emerald-900/50',
                  'bg-emerald-800/80',
                  'bg-emerald-600',
                  'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.3)]',
                ]

                return (
                  <div
                    key={idx}
                    title={`${day.date}: ${day.count} submissions`}
                    className={`w-3 h-3 rounded-[2px] transition-all duration-150 hover:scale-125 cursor-pointer ${bgColors[day.level]}`}
                  />
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Recent Telemetry & Submissions */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Activity className="w-4 h-4 text-primary" />
          <span>Recent Submissions</span>
        </div>

        <div className="divide-y divide-white/5 text-xs font-mono">
          {recentSubmissions.length === 0 ? (
            <div className="py-6 text-center text-text-muted">
              No recent submissions yet. Start solving problems to track your activity!
            </div>
          ) : (
            recentSubmissions.slice(0, 5).map((sub) => (
              <div key={sub.id} className="py-2.5 flex items-center justify-between text-text-secondary">
                <div className="flex items-center gap-2">
                  {sub.verdict === 'Accepted' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span>
                    {sub.problem_title || `Problem #${sub.problem_id}`} ({sub.language})
                  </span>
                  <VerdictBadge verdict={sub.verdict} showIcon={false} className="text-[10px] py-0 px-1.5" />
                </div>
                <div className="flex items-center gap-3 text-text-muted text-[11px]">
                  {sub.runtime !== undefined && <span>{formatRuntime(sub.runtime)}</span>}
                  <span>{formatTimeAgo(sub.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
