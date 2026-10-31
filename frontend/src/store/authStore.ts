import { create } from 'zustand'
import { api, getStoredToken, setStoredToken } from '../lib/api/client'
import { MOCK_USER } from '../lib/api/mockData'
import type { User } from '../lib/api/types'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  initAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredToken() || 'mock-init-token',
  user: MOCK_USER,
  isAuthenticated: true, // Default to authenticated in mock mode for instant exploration
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true })
    try {
      const res = await api.login(username, password)
      set({
        token: res.access_token,
        user: res.user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true })
    try {
      const res = await api.register(username, email, password)
      set({
        token: res.access_token,
        user: res.user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: () => {
    setStoredToken(null)
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    })
  },

  initAuth: async () => {
    const token = getStoredToken()
    if (!token) return

    set({ isLoading: true })
    try {
      const user = await api.getCurrentUser()
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      // Fallback: keep mock user
      set({
        user: MOCK_USER,
        isAuthenticated: true,
        isLoading: false,
      })
    }
  },
}))

// Listen for global 401 unauth events
if (typeof window !== 'undefined') {
  window.addEventListener('judgely:unauthorized', () => {
    useAuthStore.getState().logout()
  })
}

