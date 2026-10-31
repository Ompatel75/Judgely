import React from 'react'
import { cn } from '../../lib/utils'
import type { Difficulty, Verdict } from '../../lib/api/types'
import { Check, X, Clock, AlertTriangle, Cpu, Loader2 } from 'lucide-react'

export interface DifficultyBadgeProps {
  difficulty: Difficulty
  className?: string
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({
  difficulty,
  className,
}) => {
  const styles = {
    Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Hard: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border tracking-wide uppercase',
        styles[difficulty],
        className
      )}
    >
      {difficulty}
    </span>
  )
}

export interface VerdictBadgeProps {
  verdict: Verdict
  className?: string
  showIcon?: boolean
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  verdict,
  className,
  showIcon = true,
}) => {
  switch (verdict) {
    case 'Accepted':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
            className
          )}
        >
          {showIcon && <Check className="w-3 h-3 stroke-[2.5]" />}
          Accepted
        </span>
      )
    case 'Wrong Answer':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-red-500/10 text-red-400 border border-red-500/20',
            className
          )}
        >
          {showIcon && <X className="w-3 h-3 stroke-[2.5]" />}
          Wrong Answer
        </span>
      )
    case 'Time Limit Exceeded':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20',
            className
          )}
        >
          {showIcon && <Clock className="w-3 h-3" />}
          Time Limit Exceeded
        </span>
      )
    case 'Memory Limit Exceeded':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-600/10 text-amber-500 border border-amber-600/20',
            className
          )}
        >
          {showIcon && <Cpu className="w-3 h-3" />}
          Memory Limit Exceeded
        </span>
      )
    case 'Runtime Error':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20',
            className
          )}
        >
          {showIcon && <AlertTriangle className="w-3 h-3" />}
          Runtime Error
        </span>
      )
    case 'Compilation Error':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20',
            className
          )}
        >
          {showIcon && <AlertTriangle className="w-3 h-3" />}
          Compilation Error
        </span>
      )
    case 'Running':
    case 'Pending':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20 animate-pulse',
            className
          )}
        >
          {showIcon && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
          {verdict}
        </span>
      )
  }
}

