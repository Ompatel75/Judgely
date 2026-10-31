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

// In-memory state for mock modifications
let inMemorySubmissions = [...MOCK_SUBMISSIONS]
let inMemoryProblems = [...MOCK_PROBLEMS]

async function request<T>(
  path: string,
  options: RequestInit = {},
  fallback: () => T | Promise<T>
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

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    })

    if (res.status === 401) {
      setStoredToken(null)
      // Dispatches custom event for reactive logout
      window.dispatchEvent(new Event('judgely:unauthorized'))
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}))
      throw new Error(errorBody.detail || errorBody.message || `Request failed with status ${res.status}`)
    }

    return await res.json()
  } catch (err) {
    console.warn(`[Judgely API] Request to ${path} failed or backend unreachable. Falling back to mock data.`, err)
    return await fallback()
  }
}

export const api = {
  // Auth
  async login(username: string, _password: string): Promise<{ access_token: string; user: User }> {
    return request(
      ENDPOINTS.LOGIN,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password: _password }).toString(),
      },
      () => {
        const token = `mock-jwt-token-${Date.now()}`
        setStoredToken(token)
        return {
          access_token: token,
          user: {
            ...MOCK_USER,
            username,
          },
        }
      }
    )
  },

  async register(username: string, email: string, _password: string): Promise<{ access_token: string; user: User }> {
    return request(
      ENDPOINTS.REGISTER,
      {
        method: 'POST',
        body: JSON.stringify({ username, email, password: _password }),
      },
      () => {
        const token = `mock-jwt-token-${Date.now()}`
        setStoredToken(token)
        return {
          access_token: token,
          user: {
            id: Date.now(),
            username,
            email,
            created_at: new Date().toISOString(),
            solved_count: 0,
            ranking: 999,
            streak_days: 1,
          },
        }
      }
    )
  },

  async getCurrentUser(): Promise<User> {
    return request(
      ENDPOINTS.ME,
      { method: 'GET' },
      () => MOCK_USER
    )
  },

  // Problems
  async getProblems(): Promise<Problem[]> {
    return request(
      ENDPOINTS.PROBLEMS,
      { method: 'GET' },
      () => inMemoryProblems
    )
  },

  async getProblem(id: number | string): Promise<Problem> {
    const numId = Number(id)
    return request(
      ENDPOINTS.PROBLEM_DETAIL(id),
      { method: 'GET' },
      () => {
        const found = inMemoryProblems.find((p) => p.id === numId)
        if (!found) {
          throw new Error(`Problem with ID ${id} not found`)
        }
        return found
      }
    )
  },

  // Submissions
  async submitCode(payload: {
    problem_id: number
    language: SupportedLanguage
    code: string
  }): Promise<{ id: number; task_id?: string; verdict: Verdict }> {
    return request(
      ENDPOINTS.SUBMIT,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      async () => {
        // Mock asynchronous judging simulation
        const subId = Math.floor(1000 + Math.random() * 9000)
        const taskId = `task-${subId}-${Date.now()}`
        const prob = inMemoryProblems.find((p) => p.id === payload.problem_id)

        const newSub: Submission = {
          id: subId,
          problem_id: payload.problem_id,
          problem_title: prob?.title || 'Problem',
          user_id: 1,
          username: 'alex_chen',
          language: payload.language,
          code: payload.code,
          verdict: 'Pending',
          task_id: taskId,
          created_at: new Date().toISOString(),
          runtime: undefined,
          memory: undefined,
          test_cases_passed: 0,
          total_test_cases: prob?.test_cases.length || 5,
        }

        inMemorySubmissions.unshift(newSub)

        return {
          id: subId,
          task_id: taskId,
          verdict: 'Pending',
        }
      }
    )
  },

  async getMySubmissions(): Promise<Submission[]> {
    return request(
      ENDPOINTS.SUBMISSIONS_MY,
      { method: 'GET' },
      () => inMemorySubmissions
    )
  },

  async getSubmission(id: number | string): Promise<Submission> {
    const numId = Number(id)
    return request(
      ENDPOINTS.SUBMISSION_DETAIL(id),
      { method: 'GET' },
      () => {
        const found = inMemorySubmissions.find((s) => s.id === numId)
        if (!found) throw new Error(`Submission #${id} not found`)
        return found
      }
    )
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
      () => {
        // Check submission in memory
        const sub = inMemorySubmissions.find((s) => s.task_id === taskId)
        if (!sub) return { status: 'done', verdict: 'Accepted', runtime: 18, memory: 15400 }

        // Transition mock states if still pending
        if (sub.verdict === 'Pending') {
          sub.verdict = 'Running'
          return { status: 'running' }
        } else if (sub.verdict === 'Running') {
          // If code contains common errors or is very short
          if (sub.code.length < 50) {
            sub.verdict = 'Wrong Answer'
            sub.error_message = 'Failed on test case 2: output mismatch'
            sub.test_cases_passed = 1
            sub.total_test_cases = 5
          } else {
            sub.verdict = 'Accepted'
            sub.runtime = Math.floor(10 + Math.random() * 35)
            sub.memory = Math.floor(14000 + Math.random() * 4000)
            sub.test_cases_passed = sub.total_test_cases || 10
            sub.total_test_cases = sub.total_test_cases || 10
          }
          return {
            status: 'done',
            verdict: sub.verdict,
            runtime: sub.runtime,
            memory: sub.memory,
            passed_cases: sub.test_cases_passed,
            total_cases: sub.total_test_cases,
            error_message: sub.error_message,
          }
        }

        return {
          status: 'done',
          verdict: sub.verdict,
          runtime: sub.runtime,
          memory: sub.memory,
          passed_cases: sub.test_cases_passed,
          total_cases: sub.total_test_cases,
          error_message: sub.error_message,
        }
      }
    )
  },

  // AI Tutor & Hints
  async getNextHint(problemId: number): Promise<{ hint: string; help_level: string }> {
    return request(
      ENDPOINTS.AI_NEXT_HINT(problemId),
      { method: 'GET' },
      () => {
        return {
          help_level: 'gentle',
          hint: 'Think about the structure of the input: since the array is already sorted, can you maintain two pointers at both ends and move them inward depending on whether their sum is too small or too large?',
        }
      }
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
      () => {
        let answer = ''
        if (payload.prompt_type === 'approach') {
          answer = `### Recommended Algorithmic Approach

1. **Two Pointer Technique**:
   - Initialize \`left = 0\` and \`right = n - 1\`.
   - Compute \`current_sum = a[left] + a[right]\`.
   - If \`current_sum == target\`, return the 1-based indices $[left + 1, right + 1]$.
   - If \`current_sum < target\`, we need a larger sum, so increment \`left++\`.
   - If \`current_sum > target\`, we need a smaller sum, so decrement \`right--\`.

**Complexity Analysis**:
- **Time Complexity**: $\\mathcal{O}(N)$ since each pointer moves at most $N$ times.
- **Space Complexity**: $\\mathcal{O}(1)$ auxiliary space, satisfying constraints.`
        } else if (payload.prompt_type === 'bug_detect') {
          answer = `### Diagnostic Analysis 🔍

Looking at your submission:
1. **64-bit Integer Overflow**: If summing two large values like $10^9 + 10^9$, casting to \`long long\` or \`int64_t\` is required before addition.
2. **1-Indexed Output**: Ensure your returned indices are adjusted by $+1$ according to the problem constraints.`
        } else {
          answer = `**Nudge Hint**: Notice that sorting eliminates the need for a hash map with $\\mathcal{O}(N)$ space! Start by checking the sum of the extreme ends: $a_1 + a_n$. If this sum is less than $T$, can $a_1$ ever pair with any other element in the array to reach $T$?`
        }

        return {
          hint: answer,
          status: 'done',
        }
      }
    )
  },

  // User Stats & Profile
  async getUserStats(): Promise<UserStats> {
    return request(
      '/api/users/stats',
      { method: 'GET' },
      () => MOCK_USER_STATS
    )
  },

  async getHealth(): Promise<{ status: string; database?: string; redis?: string; ai_model?: string }> {
    return request(
      ENDPOINTS.HEALTH,
      { method: 'GET' },
      () => ({ status: 'healthy', database: 'ok', redis: 'ok', ai_model: 'gemini-3.8-flash' })
    )
  },
}

