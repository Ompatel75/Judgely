import { API_BASE_URL, ENDPOINTS } from './endpoints'
import {
  MOCK_PROBLEMS,
  MOCK_SUBMISSIONS,
  MOCK_USER,
  MOCK_USER_STATS,
} from './mockData'
import type {
  Difficulty,
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

export class ApiError extends Error {
  status?: number
  isNetworkError?: boolean
  isTimeout?: boolean
  detail?: string

  constructor(message: string, opts?: { status?: number; isNetworkError?: boolean; isTimeout?: boolean; detail?: string }) {
    super(message)
    this.name = 'ApiError'
    this.status = opts?.status
    this.isNetworkError = opts?.isNetworkError
    this.isTimeout = opts?.isTimeout
    this.detail = opts?.detail
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  fallback?: () => T | Promise<T>,
  retries = 1,
  timeoutMs = 45000
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
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.status === 401) {
        setStoredToken(null)
        window.dispatchEvent(new Event('judgely:unauthorized'))
      }

      if (!res.ok) {
        // Retry only cold-start-type transient server errors (502, 503, 504)
        if ([502, 503, 504].includes(res.status) && attempt < retries) {
          console.warn(`[Judgely API] HTTP ${res.status} on ${path}. Retrying after delay...`)
          await new Promise((r) => setTimeout(r, 1500))
          continue
        }

        const errorBody = await res.json().catch(() => ({}))
        const errorDetail = errorBody.detail || errorBody.message
        console.error(`[Judgely API] Error ${res.status} on ${url}:`, errorDetail || res.statusText)
        throw new ApiError(errorDetail || `Request failed with status ${res.status}`, {
          status: res.status,
          detail: errorDetail,
        })
      }

      return await res.json()
    } catch (err: any) {
      clearTimeout(timer)
      lastErr = err

      const isAbort = err?.name === 'AbortError'
      const isTypeError = err instanceof TypeError

      console.error(`[Judgely API] Request failed (${url}, attempt ${attempt + 1}/${retries + 1}):`, err)

      // If aborted by timeout or transient network failure during cold start, retry once
      if ((isAbort || isTypeError) && attempt < retries) {
        console.warn(`[Judgely API] Transient failure on ${path}. Retrying...`)
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }

      if (isAbort) {
        throw new ApiError('Request timed out. The server took too long to respond.', { isTimeout: true })
      }
      if (isTypeError) {
        throw new ApiError('Unable to connect to the server. Please check your connection or CORS settings.', { isNetworkError: true })
      }
      throw err
    }
  }

  if (USE_MOCKS && fallback) {
    console.warn(`[Judgely API] Request to ${path} failed after retries. Using mock fallback.`, lastErr)
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
    const rawList = await request<any[]>(
      ENDPOINTS.PROBLEMS,
      { method: 'GET' },
      () => MOCK_PROBLEMS
    )
    return rawList.map((p) => ({
      id: p.id,
      title: p.title,
      slug: `problem-${p.id}`,
      description: p.description,
      difficulty: (p.difficulty || 'Medium') as Difficulty,
      time_limit: p.time_limit || 1.0,
      memory_limit: p.memory_limit || 256,
      acceptance_rate: p.acceptance_rate || 50.0,
      total_submissions: p.total_submissions || 0,
      total_accepted: p.total_accepted || 0,
      tags: typeof p.tags === 'string' ? p.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (p.tags || []),
      test_cases: (p.test_cases || []).map((tc: any) => ({
        id: tc.id,
        input: tc.input_data ?? tc.input ?? '',
        output: tc.expected_output ?? tc.output ?? '',
        is_sample: !tc.is_hidden,
        explanation: tc.explanation,
      })),
    }))
  },

  async getProblem(id: number | string): Promise<Problem> {
    const p = await request<any>(
      ENDPOINTS.PROBLEM_DETAIL(id),
      { method: 'GET' },
      () => {
        const found = MOCK_PROBLEMS.find((prob) => prob.id === Number(id))
        if (!found) throw new Error(`Problem with ID ${id} not found`)
        return found
      }
    )
    return {
      id: p.id,
      title: p.title,
      slug: `problem-${p.id}`,
      description: p.description,
      difficulty: (p.difficulty || 'Medium') as Difficulty,
      time_limit: p.time_limit || 1.0,
      memory_limit: p.memory_limit || 256,
      acceptance_rate: p.acceptance_rate || 50.0,
      total_submissions: p.total_submissions || 0,
      total_accepted: p.total_accepted || 0,
      tags: typeof p.tags === 'string' ? p.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (p.tags || []),
      test_cases: (p.test_cases || []).map((tc: any) => ({
        id: tc.id,
        input: tc.input_data ?? tc.input ?? '',
        output: tc.expected_output ?? tc.output ?? '',
        is_sample: !tc.is_hidden,
        explanation: tc.explanation,
      })),
    }
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
  async runCode(payload: {
    problem_id?: number
    language: SupportedLanguage
    code: string
    custom_input?: string
    test_cases?: Array<{ input: string; expected?: string }>
  }): Promise<{
    status: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compilation Error' | 'Time Limit Exceeded'
    results?: Array<{
      input: string
      expected: string
      actual: string
      passed: boolean
      runtime?: number
    }>
    error?: string
  }> {
    return await request<any>(ENDPOINTS.RUN_CODE, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

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
    message?: string
  }): Promise<{ task_id?: string; hint?: string; status?: string }> {
    const promptText = payload.message || (
      payload.prompt_type === 'approach' ? 'Can you guide me on the high-level algorithmic approach for this problem?' :
      payload.prompt_type === 'bug_detect' ? 'Can you look at my code and tell me what edge cases or logic bugs I might have?' :
      'Give me a gentle nudge or hint to point me in the right direction.'
    )

    return request(
      ENDPOINTS.AI_GENERAL_CHAT,
      {
        method: 'POST',
        body: JSON.stringify({
          message: promptText,
          problem_id: payload.problem_id,
          current_code: payload.code || '',
        }),
      },
      () => ({
        reply: 'Analyze the constraints and structure of the input to determine the optimal data structure.',
        session_id: 'default',
      })
    ).then((res: any) => ({
      hint: res.reply || res.hint,
      status: 'done',
    }))
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
      () => ({ status: 'healthy', database: 'ok', redis: 'ok', ai_model: 'gemini-3.8-flash' }),
      0, // no retries on health check ping
      10000 // 10s timeout
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
