import React from 'react'
import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'subtle'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  isLoading?: boolean
  kbd?: string
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      kbd,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none rounded-md relative active:scale-[0.98]'

    const variantStyles = {
      primary:
        'bg-primary hover:bg-primary-hover text-white shadow-subtle border border-emerald-400/30 hover:border-emerald-400/50',
      secondary:
        'bg-surface-subtle hover:bg-surface-elevated text-text-primary border border-white/10 hover:border-white/20 hover:text-white',
      outline:
        'bg-transparent hover:bg-surface-subtle text-text-primary border border-white/10 hover:border-white/25',
      ghost:
        'bg-transparent hover:bg-surface-subtle text-text-secondary hover:text-text-primary',
      danger:
        'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40',
      subtle:
        'bg-primary/10 hover:bg-primary/20 text-emerald-400 border border-primary/20 hover:border-primary/40',
    }

    const sizeStyles = {
      sm: 'text-xs h-7 px-2.5 gap-1.5',
      md: 'text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-3.5 gap-2',
      lg: 'text-sm sm:text-base h-10 sm:h-11 px-4 sm:px-5 gap-2.5',
      icon: 'h-8 w-8 sm:h-9 sm:w-9 p-0',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : null}
        {children}
        {kbd && (
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono tracking-tight text-text-muted bg-surface border border-white/10 rounded">
            {kbd}
          </kbd>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

