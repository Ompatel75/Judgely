import React from 'react'
import { cn } from '../../lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'elevated' | 'interactive'
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-surface border border-white/8 shadow-subtle',
      subtle: 'bg-surface-subtle border border-white/5',
      elevated: 'bg-surface-elevated border border-white/10 shadow-elevation',
      interactive:
        'bg-surface border border-white/8 hover:border-white/20 transition-all duration-150 cursor-pointer shadow-subtle hover:bg-surface-subtle',
    }

    return (
      <div
        ref={ref}
        className={cn('rounded-lg p-4 sm:p-5', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

