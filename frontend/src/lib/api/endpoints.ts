// Centralized API endpoint paths
// If VITE_API_URL is set (recommended on Vercel), use it.
// Default to the production Render URL to avoid any relative routing back to Vercel.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://judgely-1.onrender.com'

export const ENDPOINTS = {
  // Auth
  LOGIN: '/api/users/login',
  REGISTER: '/api/users/register',
  ME: '/api/users/me',
  USER_PROFILE: '/api/users/profile',

  // Problems
  PROBLEMS: '/api/problems/',
  PROBLEM_DETAIL: (id: number | string) => `/api/problems/${id}`,
  PROBLEM_TESTCASES: (id: number | string) => `/api/problems/${id}/testcases`,
  GENERATE_AI_PROBLEM: '/api/problems/generate-ai',

  // Submissions & Judging
  SUBMIT: '/api/submissions/',
  RUN_CODE: '/api/submissions/run',
  SUBMISSIONS_MY: '/api/submissions/',
  SUBMISSIONS_STATUS: '/api/submissions/me/status',
  SUBMISSION_DETAIL: (id: number | string) => `/api/submissions/${id}`,
  SUBMISSION_TASK_STATUS: (taskId: string) => `/api/submissions/task/${taskId}`,

  // AI Suite
  AI_HINT: '/api/ai/hint',
  AI_GENERAL_CHAT: '/api/ai/general-chat',
  AI_HINT_TASK: (taskId: string) => `/api/ai/hint/${taskId}`,
  AI_HINT_STREAM: (submissionId: number | string) =>
    `/api/ai/hint/stream/${submissionId}`,
  AI_NEXT_HINT: (problemId: number | string) => `/api/hints/${problemId}/next`,
  AI_CODE_REVIEW: '/api/reviews/',
  AI_INTERVIEW_SESSION: '/api/interview/session',

  // System
  HEALTH: '/health',
} as const
