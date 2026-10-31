import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Terminal, ArrowRight, Check, Play, Sparkles, Cpu, Clock, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui/Button'

export const LandingPage: React.FC = () => {
  // Live-looking typed code editor preview
  const codeLines = [
    '#include <iostream>',
    '#include <vector>',
    'using namespace std;',
    '',
    'int main() {',
    '    ios_base::sync_with_stdio(false);',
    '    cin.tie(NULL);',
    '    // Two-pointer approach in O(N)',
    '    int l = 0, r = n - 1;',
    '    while (l < r) {',
    '        long long s = a[l] + a[r];',
    '        if (s == target) return cout << l+1 << " " << r+1, 0;',
    '        if (s < target) l++; else r--;',
    '    }',
    '    return 0;',
    '}',
  ]

  const [displayedLineCount, setDisplayedLineCount] = useState(1)
  const [submissionPhase, setSubmissionPhase] = useState<'coding' | 'evaluating' | 'accepted'>('coding')

  useEffect(() => {
    let timer: NodeJS.Timeout

    if (submissionPhase === 'coding') {
      if (displayedLineCount < codeLines.length) {
        timer = setTimeout(() => {
          setDisplayedLineCount((prev) => prev + 1)
        }, 120)
      } else {
        // Switch to evaluating
        timer = setTimeout(() => {
          setSubmissionPhase('evaluating')
        }, 800)
      }
    } else if (submissionPhase === 'evaluating') {
      timer = setTimeout(() => {
        setSubmissionPhase('accepted')
      }, 1400)
    } else if (submissionPhase === 'accepted') {
      timer = setTimeout(() => {
        setSubmissionPhase('coding')
        setDisplayedLineCount(1)
      }, 5000)
    }

    return () => clearTimeout(timer)
  }, [displayedLineCount, submissionPhase])

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12 bg-grid-pattern overflow-hidden">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Headline, Description & CTA */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-subtle border border-white/10 text-xs font-mono text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>High-Throughput Competitive Judge</span>
            <span className="text-white/20">|</span>
            <span className="text-emerald-400">Gemini 3.8 AI Suite</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
            Competitive programming, built for engineering clarity.
          </h1>

          <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl">
            Judgely evaluates your solutions in sandboxed Docker containers via Celery queues, renders LaTeX problem statements with KaTeX precision, and provides Socratic hints through Gemini Flash in under 8ms.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link to="/problems">
              <Button variant="primary" size="lg" className="w-full sm:w-auto text-sm font-semibold">
                Start solving
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/problems/1">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto text-sm font-mono">
                <Play className="w-3.5 h-3.5 text-text-muted" />
                Try interactive demo
              </Button>
            </Link>
          </div>

          {/* Architecture telemetry badges */}
          <div className="pt-6 border-t border-white/8 grid grid-cols-3 gap-4 text-left">
            <div>
              <div className="text-xs font-mono text-text-muted">Pre-cached Hints</div>
              <div className="text-base sm:text-lg font-mono font-bold text-emerald-400 mt-0.5">
                &lt; 8 ms
              </div>
            </div>
            <div>
              <div className="text-xs font-mono text-text-muted">Async Throughput</div>
              <div className="text-base sm:text-lg font-mono font-bold text-text-primary mt-0.5">
                20.8x
              </div>
            </div>
            <div>
              <div className="text-xs font-mono text-text-muted">Sandbox Isolation</div>
              <div className="text-base sm:text-lg font-mono font-bold text-text-primary mt-0.5">
                Docker + cgroups
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live-looking Code Editor Preview */}
        <div className="lg:col-span-6 w-full">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full bg-[#0E1116] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Window title bar */}
            <div className="h-10 px-4 bg-[#141720] border-b border-white/8 flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                </div>
                <span className="text-xs font-mono text-text-muted ml-2">
                  solution.cpp — Problem #1 (Two Sum II)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  C++20
                </span>
              </div>
            </div>

            {/* Code Body */}
            <div className="p-4 sm:p-5 font-mono text-xs text-[#E2E8F0] min-h-[290px] leading-relaxed overflow-x-auto bg-[#0B0D10]">
              {codeLines.slice(0, displayedLineCount).map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-8 text-text-muted select-none text-right pr-4 opacity-40">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre">
                    {line}
                    {idx === displayedLineCount - 1 && submissionPhase === 'coding' && (
                      <span className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-0.5 animate-pulse" />
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* Live Verdict Banner */}
            <div className="px-4 py-3 bg-[#111418] border-t border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {submissionPhase === 'coding' && (
                  <span className="text-xs font-mono text-text-muted flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary/80 animate-ping" />
                    Simulating engineer typing...
                  </span>
                )}
                {submissionPhase === 'evaluating' && (
                  <span className="text-xs font-mono text-amber-400 flex items-center gap-1.5 animate-pulse">
                    <Cpu className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    Judging on 24 test cases (Celery)...
                  </span>
                )}
                {submissionPhase === 'accepted' && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      Accepted
                    </span>
                    <span className="text-[11px] font-mono text-text-muted">
                      14ms • 15.6 MB
                    </span>
                  </motion.div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
                <span className="hidden sm:inline">Shortcut:</span>
                <kbd className="px-1.5 py-0.5 bg-[#171B21] border border-white/10 rounded text-[10px]">
                  Ctrl+Enter
                </kbd>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

