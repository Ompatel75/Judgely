import React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  icon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-text-muted pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              'w-full bg-surface-subtle text-text-primary text-sm rounded-md border border-white/10 px-3.5 py-2 placeholder:text-text-muted transition-colors duration-150',
              'focus:bg-surface focus:border-primary/50 focus-visible:outline-none focus-visible:shadow-emerald-focus',
              icon && 'pl-9',
              error && 'border-red-500/50 focus:border-red-500 focus-visible:shadow-[0_0_0_2px_#0B0D10,0_0_0_4px_rgba(239,68,68,0.4)]',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-400 font-mono tracking-tight">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

