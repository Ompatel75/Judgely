import React from 'react'
import { Terminal, Shield, Cpu } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/8 bg-[#0B0D10] text-text-muted text-xs py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-text-secondary">Judgely Online Judge</span>
          </div>
          <span className="text-white/10 hidden sm:inline">•</span>
          <span className="font-mono hidden sm:inline">Async Celery & Redis Queue</span>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Operational</span>
          </div>
          <div className="flex items-center gap-1 text-text-muted">
            <Cpu className="w-3 h-3 text-text-muted" />
            <span>Sandboxed Docker Runner</span>
          </div>
          <div className="flex items-center gap-1 text-text-muted hidden md:flex">
            <Shield className="w-3 h-3" />
            <span>JWT Secured</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

