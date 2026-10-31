import React from 'react'
import { cn } from '../../lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn('rounded bg-surface-subtle skeleton-shimmer', className)}
      {...props}
    />
  )
}

export const ProblemRowSkeleton: React.FC = () => {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-white/5">
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="w-4 h-4 rounded-full" />
        <Skeleton className="w-48 h-4" />
        <Skeleton className="w-14 h-4 rounded" />
      </div>
      <div className="flex items-center gap-6">
        <Skeleton className="w-20 h-4 hidden sm:block" />
        <Skeleton className="w-16 h-4" />
      </div>
    </div>
  )
}

