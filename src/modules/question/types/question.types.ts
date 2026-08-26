// src/modules/question/types/question.types.ts

export interface Answer {
  name: string
  score: number | null
  evaluation: string
  answer: string
}

export interface QuestionBase {
  id: string
  category: string
  question: string
  updated_at?: Date
}

export type Question = QuestionBase

export interface QuestionDetail extends QuestionBase {
  answers: Answer[]
  standard_answer: string
}

export interface QuestionsResponse {
  list: Question[]
  total: number
  pageNum: number
  pageSize: number
}

export interface StandardAnswerResponse extends QuestionBase {
  standard_answer: string
}

export interface SaveStandardAnswerDto extends Omit<StandardAnswerResponse, 'category' | 'question'> {
  category?: string
  question?: string
}
