import { create } from 'zustand'
import { api, getStoredToken, setStoredToken } from '../lib/api/client'
import { queryClient } from '../lib/queryClient'
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
  token: getStoredToken(),
  user: null,
  isAuthenticated: false,
  isLoading: !!getStoredToken(),

  login: async (username, password) => {
    set({ isLoading: true })
    try {
      // Clear any prior cached data from other users
      queryClient.clear()
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
      // Clear any prior cached data
      queryClient.clear()
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
    queryClient.clear()
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })
  },

  initAuth: async () => {
    const token = getStoredToken()
    if (!token) {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false })
      return
    }

    set({ isLoading: true })
    try {
      const user = await api.getCurrentUser()
      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      // On failure, clear invalid token and log out - never fall back to mock user
      setStoredToken(null)
      queryClient.clear()
      set({
        token: null,
        user: null,
        isAuthenticated: false,
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
