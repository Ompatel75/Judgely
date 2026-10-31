import React from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { RotateCcw, ZoomIn, ZoomOut, Code } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { SupportedLanguage } from '../../lib/api/types'
import { Button } from '../ui/Button'

interface CodeEditorProps {
  problemId: number
  onRun?: () => void
  onSubmit?: () => void
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  problemId,
  onSubmit,
}) => {
  const {
    language,
    setLanguage,
    fontSize,
    setFontSize,
    getCode,
    setCode,
    resetCode,
  } = useEditorStore()

  const currentCode = getCode(problemId, language)

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Define custom Judgely dark theme matching app colors
    monaco.editor.defineTheme('judgely-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6E7681', fontStyle: 'italic' },
        { token: 'keyword', foreground: '10B981', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'E6E8EB' },
        { token: 'string', foreground: '6EE7B7' },
        { token: 'number', foreground: 'FCD34D' },
        { token: 'type', foreground: '60A5FA' },
        { token: 'delimiter', foreground: '8B949E' },
      ],
      colors: {
        'editor.background': '#0E1116',
        'editor.foreground': '#E6E8EB',
        'editor.lineHighlightBackground': '#141820',
        'editorLineNumber.foreground': '#4B5563',
        'editorLineNumber.activeForeground': '#10B981',
        'editorCursor.foreground': '#10B981',
        'editor.selectionBackground': '#10B98133',
        'editor.inactiveSelectionBackground': '#10B9811A',
        'editorIndentGuide.background': '#1F242C',
        'editorIndentGuide.activeBackground': '#374151',
      },
    })
    monaco.editor.setTheme('judgely-dark')

    // Attach Ctrl+Enter command to trigger submit
    if (onSubmit) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onSubmit()
      })
    }
  }

  const monacoLangMap: Record<SupportedLanguage, string> = {
    cpp: 'cpp',
    python: 'python',
    java: 'java',
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0E1116] border border-white/8 rounded-lg overflow-hidden">
      {/* Editor Top Bar */}
      <div className="h-10 px-3 bg-[#111418] border-b border-white/8 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              aria-label="Programming Language"
              className="bg-[#171B21] border border-white/10 rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="cpp">C++ (GCC 13 / C++20)</option>
              <option value="python">Python 3.11</option>
              <option value="java">Java 21 (OpenJDK)</option>
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {/* Font size control */}
          <div className="flex items-center border border-white/10 rounded bg-[#171B21] text-text-muted">
            <button
              onClick={() => setFontSize(fontSize - 1)}
              title="Decrease font size"
              className="p-1 hover:text-text-primary hover:bg-white/5 transition-colors focus-visible:outline-none"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-text-secondary select-none">
              {fontSize}px
            </span>
            <button
              onClick={() => setFontSize(fontSize + 1)}
              title="Increase font size"
              className="p-1 hover:text-text-primary hover:bg-white/5 transition-colors focus-visible:outline-none"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Reset Code */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm('Reset code to starter template? Your current edits will be cleared.')) {
                resetCode(problemId, language)
              }
            }}
            title="Reset code template"
            className="text-text-muted hover:text-text-primary h-7 px-2"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline text-xs">Reset</span>
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 w-full relative min-h-[300px]">
        <Editor
          height="100%"
          language={monacoLangMap[language]}
          value={currentCode}
          theme="judgely-dark"
          onMount={handleEditorDidMount}
          onChange={(val) => setCode(problemId, language, val || '')}
          options={{
            fontSize: fontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            lineHeight: 22,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'line',
            tabSize: 4,
            bracketPairColorization: { enabled: true },
          }}
          loading={
            <div className="h-full flex items-center justify-center text-xs font-mono text-text-muted">
              Loading editor environment...
            </div>
          }
        />
      </div>
    </div>
  )
}

