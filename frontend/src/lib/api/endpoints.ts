// Centralized API endpoint paths
// In production on Vercel, leaving it empty uses the vercel.json reverse proxy (avoids CORS).
// If VITE_API_URL is explicitly set, it takes precedence.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : (import.meta.env.PROD ? '' : 'https://judgely-1.onrender.com')

export const ENDPOINTS = {
  // Auth
  LOGIN: '/api/users/login',
  REGISTER: '/api/users/register',
  ME: '/api/users/me',

  // Problems
  PROBLEMS: '/api/problems/',
  PROBLEM_DETAIL: (id: number | string) => `/api/problems/${id}`,
  GENERATE_AI_PROBLEM: '/api/problems/generate-ai',

  // Submissions & Judging
  SUBMIT: '/api/submissions/',
  SUBMISSIONS_MY: '/api/submissions/my',
  SUBMISSION_DETAIL: (id: number | string) => `/api/submissions/${id}`,
  SUBMISSION_TASK_STATUS: (taskId: string) => `/api/submissions/task/${taskId}`,

  // AI Suite
  AI_HINT: '/api/ai/hint',
  AI_HINT_TASK: (taskId: string) => `/api/ai/hint/${taskId}`,
  AI_HINT_STREAM: (submissionId: number | string) =>
    `/api/ai/hint/stream/${submissionId}`,
  AI_NEXT_HINT: (problemId: number | string) => `/api/hints/${problemId}/next`,
  AI_CODE_REVIEW: '/api/reviews/',
  AI_INTERVIEW_SESSION: '/api/interview/session',

  // System
  HEALTH: '/health',
} as const
