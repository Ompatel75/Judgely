import { create } from 'zustand'
import { STARTER_CODE } from '../lib/api/mockData'
import type { SupportedLanguage } from '../lib/api/types'

interface EditorState {
  language: SupportedLanguage
  fontSize: number
  codeMap: Record<string, string> // key: `${problemId}_${language}`
  activeTab: 'description' | 'submissions' | 'ai_tutor'
  setLanguage: (lang: SupportedLanguage) => void
  setFontSize: (size: number) => void
  getCode: (problemId: number, lang: SupportedLanguage) => string
  setCode: (problemId: number, lang: SupportedLanguage, code: string) => void
  resetCode: (problemId: number, lang: SupportedLanguage) => void
  setActiveTab: (tab: 'description' | 'submissions' | 'ai_tutor') => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  language: 'cpp',
  fontSize: 14,
  codeMap: {},
  activeTab: 'description',

  setLanguage: (lang) => set({ language: lang }),
  setFontSize: (size) => set({ fontSize: Math.min(22, Math.max(11, size)) }),

  getCode: (problemId, lang) => {
    const key = `${problemId}_${lang}`
    return get().codeMap[key] ?? STARTER_CODE[lang] ?? ''
  },

  setCode: (problemId, lang, code) => {
    const key = `${problemId}_${lang}`
    set((state) => ({
      codeMap: {
        ...state.codeMap,
        [key]: code,
      },
    }))
  },

  resetCode: (problemId, lang) => {
    const key = `${problemId}_${lang}`
    const starter = STARTER_CODE[lang] || ''
    set((state) => ({
      codeMap: {
        ...state.codeMap,
        [key]: starter,
      },
    }))
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
}))

