import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Terminal, Code2, History, Sparkles, User as UserIcon, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

export const Navbar: React.FC = () => {
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuthStore()

  const navLinks = [
    { to: '/problems', label: 'Problems', icon: Code2 },
    { to: '/submissions', label: 'Submissions', icon: History },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/8 bg-[#0B0D10]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 group focus-visible:outline-none"
          >
            <div className="w-7 h-7 rounded-md bg-surface-subtle border border-white/10 flex items-center justify-center text-primary group-hover:border-primary/40 transition-colors">
              <Terminal className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold tracking-tight text-white text-base">
                Judgely
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AI v2
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              const isActive = location.pathname.startsWith(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-surface-subtle text-white border border-white/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-text-muted" />
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-surface-subtle border border-white/5 text-[11px] font-mono text-text-muted">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Gemini Flash 3.8</span>
            <span className="text-white/20">|</span>
            <span className="text-emerald-400">8ms Hints</span>
          </div>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface-subtle border border-white/10 hover:border-white/20 transition-all text-xs font-medium text-text-primary"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-[10px] font-bold">
                  {user.username.slice(0, 1).toUpperCase()}
                </div>
                <span className="hidden sm:inline font-mono">{user.username}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title="Sign out"
                className="text-text-muted hover:text-red-400"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Link to="/auth">
              <Button variant="primary" size="sm">
                <UserIcon className="w-3.5 h-3.5" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

