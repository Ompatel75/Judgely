import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Terminal, Lock, User, Mail, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export const AuthPage: React.FC = () => {
  const navigate = useNavigate()
  const { login, register, isLoading } = useAuthStore()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username.trim()) {
      setError('Username is required.')
      return
    }

    if (mode === 'register' && !email.trim()) {
      setError('Email address is required.')
      return
    }

    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }

    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await register(username, email, password)
      }
      navigate('/problems')
    } catch (err: any) {
      const msg: string = err.message || ''
      // Network / 502 / 504 — backend cold-starting on Render
      if (
        msg.toLowerCase().includes('failed to fetch') ||
        msg.includes('502') ||
        msg.includes('504') ||
        msg.includes('NetworkError')
      ) {
        setRetrying(true)
        setError('The server is waking up (Render free tier). Retrying automatically…')
        // The request() function already retried; this is the final failure — advise user to try again
        setTimeout(() => {
          setRetrying(false)
          setError('Server is still starting up. Please click Sign In again in a few seconds.')
        }, 3000)
      } else {
        setRetrying(false)
        setError(msg || 'Authentication failed. Please verify credentials.')
      }
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 bg-grid-pattern">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-lg bg-surface border border-white/10 flex items-center justify-center text-primary mx-auto shadow-subtle">
            <Terminal className="w-5 h-5 stroke-[2.2]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            {mode === 'login' ? 'Welcome back to Judgely' : 'Create an Engineer Account'}
          </h1>
          <p className="text-xs text-text-muted">
            {mode === 'login'
              ? 'Enter your credentials to access your judge telemetry.'
              : 'Sign up to submit code and get AI Socratic tutoring.'}
          </p>
        </div>

        {/* Card */}
        <Card className="p-6 space-y-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-[#141820] border border-white/8 rounded-lg text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError(null)
              }}
              className={`py-1.5 rounded-md font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-surface text-white border border-white/10 shadow-subtle'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setError(null)
              }}
              className={`py-1.5 rounded-md font-medium transition-colors ${
                mode === 'register'
                  ? 'bg-surface text-white border border-white/10 shadow-subtle'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className={`p-2.5 rounded border text-xs font-mono ${retrying ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1.5">
                Username
              </label>
              <Input
                type="text"
                placeholder="e.g. alex_chen"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                icon={<User className="w-3.5 h-3.5" />}
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-mono text-text-muted mb-1.5">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="alex@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="w-3.5 h-3.5" />}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-text-muted mb-1.5">
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-3.5 h-3.5" />}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full text-xs font-semibold mt-2"
              isLoading={isLoading}
            >
              <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </form>

          <div className="pt-2 text-center text-[11px] font-mono text-text-muted flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>JWT Bearer authenticated session</span>
          </div>
        </Card>
      </div>
    </div>
  )
}

