import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface TabItem {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
}

export interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
  layoutId?: string
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  layoutId = 'activeTabUnderline',
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-1 border-b border-white/8 overflow-x-auto no-scrollbar',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors select-none focus-visible:outline-none whitespace-nowrap',
              isActive
                ? 'text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.02]'
            )}
          >
            {tab.icon && (
              <span
                className={cn(
                  'transition-colors',
                  isActive ? 'text-primary' : 'text-text-muted'
                )}
              >
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded text-[10px] font-mono',
                  isActive
                    ? 'bg-primary/20 text-emerald-300'
                    : 'bg-surface-elevated text-text-muted'
                )}
              >
                {tab.badge}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

