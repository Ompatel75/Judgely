import { API_BASE_URL, ENDPOINTS } from './endpoints'
import {
  MOCK_PROBLEMS,
  MOCK_SUBMISSIONS,
  MOCK_USER,
  MOCK_USER_STATS,
} from './mockData'
import type {
  Problem,
  Submission,
  SupportedLanguage,
  User,
  UserStats,
  Verdict,
} from './types'

const TOKEN_KEY = 'judgely_token'
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  fallback?: () => T | Promise<T>,
  retries = 2
): Promise<T> {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers })

      if (res.status === 401) {
        setStoredToken(null)
        window.dispatchEvent(new Event('judgely:unauthorized'))
      }

      if (!res.ok) {
        // 5xx are transient (Render cold-start 502/504); retry them
        if (res.status >= 500 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
          continue
        }
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Request failed with status ${res.status}`)
      }

      return await res.json()
    } catch (err) {
      lastErr = err
      // TypeError = network failure (offline / CORS on cold-start); retry
      if (err instanceof TypeError && attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
        continue
      }
      // Known API error (non-5xx) — stop immediately
      if (!(err instanceof TypeError)) throw err
    }
  }

  if (USE_MOCKS && fallback) {
    console.warn(`[Judgely API] Request to ${path} failed after ${retries + 1} attempts. Using mock fallback.`, lastErr)
    return await fallback()
  }
  throw lastErr
}

export const api = {
  // Auth
  async login(username: string, _password: string): Promise<{ access_token: string; user: User }> {
    const res = await request<{ access_token: string; token_type: string }>(
      ENDPOINTS.LOGIN,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password: _password }).toString(),
      },
      () => ({
        access_token: `mock-jwt-token-${Date.now()}`,
        token_type: 'bearer',
      })
    )

    setStoredToken(res.access_token)

    // Call /api/users/me with the newly stored token to get the real User
    const user = await api.getCurrentUser()
    return {
      access_token: res.access_token,
      user,
    }
  },

  async register(username: string, email: string, _password: string): Promise<{ access_token: string; user: User }> {
    await request<User>(
      ENDPOINTS.REGISTER,
      {
        method: 'POST',
        body: JSON.stringify({ username, email, password: _password }),
      },
      () => ({
        id: Date.now(),
        username,
        email,
        is_admin: false,
        created_at: new Date().toISOString(),
      })
    )

    // Log in with the newly registered credentials
    return api.login(username, _password)
  },

  async getCurrentUser(): Promise<User> {
    return request<User>(
      ENDPOINTS.ME,
      { method: 'GET' },
      () => ({
        ...MOCK_USER,
        id: 1,
        username: 'guest_user',
        email: 'guest@judgely.dev',
      })
    )
  },

  // Problems
  async getProblems(): Promise<Problem[]> {
    return request<Problem[]>(
      ENDPOINTS.PROBLEMS,
      { method: 'GET' },
      () => MOCK_PROBLEMS
    )
  },

  async getProblem(id: number | string): Promise<Problem> {
    return request<Problem>(
      ENDPOINTS.PROBLEM_DETAIL(id),
      { method: 'GET' },
      () => {
        const found = MOCK_PROBLEMS.find((p) => p.id === Number(id))
        if (!found) throw new Error(`Problem with ID ${id} not found`)
        return found
      }
    )
  },

  // Problem Status for Authenticated User
  async getProblemStatus(): Promise<Record<number, string>> {
    return request<Record<number, string>>(
      ENDPOINTS.SUBMISSIONS_STATUS,
      { method: 'GET' },
      () => ({})
    )
  },

  // Submissions
  async submitCode(payload: {
    problem_id: number
    language: SupportedLanguage
    code: string
  }): Promise<{ id: number; task_id?: string; verdict: Verdict }> {
    const res = await request<any>(
      ENDPOINTS.SUBMIT,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        id: Math.floor(1000 + Math.random() * 9000),
        task_id: `task-${Date.now()}`,
        verdict: 'PENDING',
      })
    )

    return {
      id: res.id,
      task_id: res.task_id,
      verdict: res.verdict === 'AC' ? 'Accepted'
        : res.verdict === 'WA' ? 'Wrong Answer'
        : res.verdict === 'TLE' ? 'Time Limit Exceeded'
        : res.verdict === 'MLE' ? 'Memory Limit Exceeded'
        : res.verdict === 'RE' ? 'Runtime Error'
        : res.verdict === 'CE' ? 'Compilation Error'
        : res.verdict === 'RUNNING' ? 'Running'
        : 'Pending',
    }
  },

  async getMySubmissions(): Promise<Submission[]> {
    const items = await request<any[]>(
      ENDPOINTS.SUBMISSIONS_MY,
      { method: 'GET' },
      () => []
    )

    return items.map((sub) => {
      const v = sub.verdict
      const verdictStr = typeof v === 'object' && v?.name ? v.name : String(v || 'PENDING')
      return {
        id: sub.id,
        problem_id: sub.problem_id,
        problem_title: sub.problem?.title || `Problem #${sub.problem_id}`,
        user_id: sub.user_id,
        username: sub.user?.username,
        language: sub.language || 'cpp',
        code: sub.code || '',
        verdict: verdictStr === 'AC' ? 'Accepted'
          : verdictStr === 'WA' ? 'Wrong Answer'
          : verdictStr === 'TLE' ? 'Time Limit Exceeded'
          : verdictStr === 'MLE' ? 'Memory Limit Exceeded'
          : verdictStr === 'RE' ? 'Runtime Error'
          : verdictStr === 'CE' ? 'Compilation Error'
          : verdictStr === 'RUNNING' ? 'Running'
          : 'Pending',
        runtime: sub.execution_time != null ? Math.round(sub.execution_time * 1000) : undefined,
        memory: sub.memory_used != null ? Math.round(sub.memory_used * 1024) : undefined,
        created_at: sub.created_at,
        error_message: sub.error_message,
        task_id: sub.task_id,
      }
    })
  },

  async getSubmission(id: number | string): Promise<Submission> {
    const sub = await request<any>(
      ENDPOINTS.SUBMISSION_DETAIL(id),
      { method: 'GET' },
      () => {
        const found = MOCK_SUBMISSIONS.find((s) => s.id === Number(id))
        if (!found) throw new Error(`Submission #${id} not found`)
        return found
      }
    )

    const v = sub.verdict
    const verdictStr = typeof v === 'object' && v?.name ? v.name : String(v || 'PENDING')
    return {
      id: sub.id,
      problem_id: sub.problem_id,
      problem_title: sub.problem?.title || `Problem #${sub.problem_id}`,
      user_id: sub.user_id,
      username: sub.user?.username,
      language: sub.language || 'cpp',
      code: sub.code || '',
      verdict: verdictStr === 'AC' ? 'Accepted'
        : verdictStr === 'WA' ? 'Wrong Answer'
        : verdictStr === 'TLE' ? 'Time Limit Exceeded'
        : verdictStr === 'MLE' ? 'Memory Limit Exceeded'
        : verdictStr === 'RE' ? 'Runtime Error'
        : verdictStr === 'CE' ? 'Compilation Error'
        : verdictStr === 'RUNNING' ? 'Running'
        : 'Pending',
      runtime: sub.execution_time != null ? Math.round(sub.execution_time * 1000) : undefined,
      memory: sub.memory_used != null ? Math.round(sub.memory_used * 1024) : undefined,
      created_at: sub.created_at,
      error_message: sub.error_message,
      task_id: sub.task_id,
    }
  },

  async pollSubmissionTask(taskId: string): Promise<{
    status: 'pending' | 'running' | 'done' | 'failed'
    verdict?: Verdict
    runtime?: number
    memory?: number
    passed_cases?: number
    total_cases?: number
    error_message?: string
  }> {
    return request(
      ENDPOINTS.SUBMISSION_TASK_STATUS(taskId),
      { method: 'GET' },
      () => ({ status: 'done', verdict: 'Accepted', runtime: 18, memory: 15400 })
    )
  },

  // AI Tutor & Hints
  async getNextHint(problemId: number): Promise<{ hint: string; help_level: string }> {
    return request(
      ENDPOINTS.AI_NEXT_HINT(problemId),
      { method: 'GET' },
      () => ({
        help_level: 'gentle',
        hint: 'Think about the structure of the input: since the array is already sorted, can you maintain two pointers at both ends and move them inward depending on whether their sum is too small or too large?',
      })
    )
  },

  async requestAIHint(payload: {
    submission_id?: number
    problem_id?: number
    code?: string
    prompt_type?: 'hint' | 'approach' | 'bug_detect'
  }): Promise<{ task_id?: string; hint?: string; status?: string }> {
    return request(
      ENDPOINTS.AI_HINT,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        hint: 'Analyze the extreme values and how two pointers can narrow down the search space.',
        status: 'done',
      })
    )
  },

  // User Stats & Profile
  async getUserStats(): Promise<UserStats> {
    const [profile, submissions, problems] = await Promise.all([
      request<any>(ENDPOINTS.USER_PROFILE, { method: 'GET' }, () => null).catch(() => null),
      api.getMySubmissions().catch(() => []),
      api.getProblems().catch(() => []),
    ])

    const totalSubmissions = profile?.total_submissions ?? submissions.length
    const solvedProblemIds = new Set<number>()
    const submissionsByDate: Record<string, number> = {}

    submissions.forEach((s) => {
      if (s.verdict === 'Accepted') {
        solvedProblemIds.add(s.problem_id)
      }
      if (s.created_at) {
        const d = s.created_at.split('T')[0]
        submissionsByDate[d] = (submissionsByDate[d] || 0) + 1
      }
    })

    const totalSolved = profile?.solved_count ?? solvedProblemIds.size
    const acceptanceRate = totalSubmissions > 0
      ? Math.round((totalSolved / totalSubmissions) * 1000) / 10
      : 0

    const probMap = new Map<number, Problem>()
    problems.forEach((p) => probMap.set(p.id, p))

    let easySolved = 0
    let mediumSolved = 0
    let hardSolved = 0
    let totalEasy = 0
    let totalMedium = 0
    let totalHard = 0

    problems.forEach((p) => {
      if (p.difficulty === 'Easy') totalEasy++
      else if (p.difficulty === 'Medium') totalMedium++
      else if (p.difficulty === 'Hard') totalHard++
    })

    solvedProblemIds.forEach((pid) => {
      const p = probMap.get(pid)
      if (p?.difficulty === 'Easy') easySolved++
      else if (p?.difficulty === 'Medium') mediumSolved++
      else if (p?.difficulty === 'Hard') hardSolved++
    })

    return {
      total_solved: totalSolved,
      total_submissions: totalSubmissions,
      acceptance_rate: acceptanceRate,
      easy_solved: easySolved,
      medium_solved: mediumSolved,
      hard_solved: hardSolved,
      total_easy: totalEasy || 1,
      total_medium: totalMedium || 1,
      total_hard: totalHard || 1,
      current_streak: totalSubmissions > 0 ? 1 : 0,
      longest_streak: totalSubmissions > 0 ? 1 : 0,
      submissions_by_date: submissionsByDate,
    }
  },

  async getHealth(): Promise<{ status: string; database?: string; redis?: string; ai_model?: string }> {
    return request(
      ENDPOINTS.HEALTH,
      { method: 'GET' },
      () => ({ status: 'healthy', database: 'ok', redis: 'ok', ai_model: 'gemini-3.8-flash' })
    )
  },

  // Admin: Create problem
  async createProblem(payload: {
    title: string
    description: string
    difficulty: string
    time_limit: number
    memory_limit: number
    tags: string
  }): Promise<{ id: number; title: string }> {
    return request(
      ENDPOINTS.PROBLEMS,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
  },

  // Admin: Add test case to a problem
  async addTestCase(problemId: number, testCase: {
    input_data: string
    expected_output: string
    is_hidden: boolean
  }): Promise<{ id: number }> {
    return request(
      ENDPOINTS.PROBLEM_TESTCASES(problemId),
      {
        method: 'POST',
        body: JSON.stringify(testCase),
      }
    )
  },
}
