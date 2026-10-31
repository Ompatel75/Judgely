export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type Verdict =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Time Limit Exceeded'
  | 'Memory Limit Exceeded'
  | 'Runtime Error'
  | 'Compilation Error'
  | 'Pending'
  | 'Running'

export type SupportedLanguage = 'cpp' | 'python' | 'java'

export interface TestCase {
  id?: number
  input: string
  output: string
  is_sample?: boolean
  explanation?: string
}

export interface Problem {
  id: number
  title: string
  slug: string
  description: string
  difficulty: Difficulty
  time_limit: number // seconds
  memory_limit: number // MB
  acceptance_rate: number // percentage, e.g. 64.5
  total_submissions: number
  total_accepted: number
  tags: string[]
  input_format?: string
  output_format?: string
  constraints?: string
  test_cases: TestCase[]
  author?: string
  status?: 'solved' | 'attempted' | 'unsolved'
}

export interface Submission {
  id: number
  problem_id: number
  problem_title?: string
  user_id: number
  username?: string
  language: SupportedLanguage
  code: string
  verdict: Verdict
  runtime?: number // in ms
  memory?: number // in KB
  test_cases_passed?: number
  total_test_cases?: number
  created_at: string
  error_message?: string
  task_id?: string
}

export interface User {
  id: number
  username: string
  email: string
  created_at: string
  solved_count?: number
  ranking?: number
  streak_days?: number
}

export interface AIHint {
  id: number
  problem_id: number
  help_level: 'gentle' | 'medium' | 'detailed'
  hint_text: string
  created_at?: string
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  isStreaming?: boolean
}

export interface UserStats {
  total_solved: number
  total_submissions: number
  acceptance_rate: number
  easy_solved: number
  medium_solved: number
  hard_solved: number
  total_easy: number
  total_medium: number
  total_hard: number
  current_streak: number
  longest_streak: number
  submissions_by_date: Record<string, number> // YYYY-MM-DD -> count
}

