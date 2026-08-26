// 路径：src/modules/question/question.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import {
  Question,
  QuestionsResponse,
  QuestionDetail,
  Answer,
  StandardAnswerResponse,
  SaveStandardAnswerDto,
} from './types/question.types'
import { safePrisma } from '@/common/utils/index'
import { Prisma } from '@prisma/client'
import { CacheService } from '@/common/cache/cache.service'

@Injectable()
export class QuestionService {
  constructor(private readonly _cacheService: CacheService) {}

  /**
   * 获取题目列表（模糊查询 + 分类 + 分页）
   */
  async getQuestionList(
    question?: string,
    category?: string,
    pageNum?: string,
    pageSize?: string,
  ): Promise<QuestionsResponse> {
    const num = Number(pageNum) || 1
    const size = Number(pageSize) || 10

    const whereCondition: Prisma.questionsWhereInput = {}

    if (category && category !== 'all') {
      whereCondition.category = category
    }

    if (question) {
      whereCondition.question = {
        contains: question,
      }
    }

    const list = await safePrisma.questions.findMany({
      where: whereCondition,
      orderBy: { id: 'asc' },
      take: size,
      skip: (num - 1) * size,
    })

    const total = await safePrisma.questions.count({
      where: whereCondition,
    })

    const result: QuestionsResponse = {
      list: list as Question[],
      total: Number(total),
      pageNum: num,
      pageSize: size,
    }

    return result
  }

  /**
   * 获取题目详情
   */
  async getQuestionDetail(id: string): Promise<QuestionDetail> {
    const cacheKey = `${this._cacheService.PREFIX.BIZ}question:detail:${id}`
    const cachedData = await this._cacheService.get<QuestionDetail>(cacheKey)

    if (cachedData) {
      return cachedData
    }

    const question = await this.getQuestionById(id)
    const standard_answer = await this.getStandardAnswer(id)
    const answers = await this.getAnswers(id)

    const result: QuestionDetail = {
      id: question.id,
      category: question.category,
      question: question.question,
      answers,
      standard_answer,
      // updated_at: question.updated_at,
    }

    await this._cacheService.set(cacheKey, result, this._cacheService.TTL.BIZ)
    return result
  }

  /**
   * 批量保存题目
   */
  async batchSaveQuestions(list: Question[]): Promise<string> {
    for (const item of list) {
      const exists = await safePrisma.questions.findUnique({
        where: { id: item.id },
      })

      if (exists) {
        await safePrisma.questions.update({
          where: { id: item.id },
          data: { category: item.category, question: item.question },
        })
      } else {
        await safePrisma.questions.create({
          data: { id: item.id, category: item.category, question: item.question },
        })
      }
    }

    await this.clearQuestionCache()
    console.log(`🗑️ 已清空题目缓存`)

    return `批量保存成功，共${list.length}条`
  }

  /**
   * 保存题目完整详情（主表 + 标准回答 + 回答列表）
   */
  async saveQuestionDetail(body: QuestionDetail): Promise<string> {
    const { id, category, question, standard_answer, answers } = body

    await safePrisma.$transaction(async (tx) => {
      await this.saveQuestionBase(tx, id, category, question)
      await tx.standard_answers.deleteMany({ where: { question_id: id } })
      await tx.interviewee_answers.deleteMany({ where: { question_id: id } })
      await this.saveStandardAnswerData(tx, id, standard_answer)
      await this.saveAnswersData(tx, id, answers)
    })

    await this.clearQuestionCache()
    console.log(`🗑️ 已清空题目缓存`)

    return '题目详情保存成功'
  }

  async getStandardAnswerOnly(id: string): Promise<StandardAnswerResponse> {
    const cacheKey = `${this._cacheService.PREFIX.BIZ}question:standard:${id}`
    const cachedData = await this._cacheService.get<StandardAnswerResponse>(cacheKey)

    if (cachedData) {
      return cachedData
    }

    const question = await this.getQuestionById(id)
    const standard_answer = await this.getStandardAnswer(id)

    const result: StandardAnswerResponse = {
      id: question.id,
      category: question.category,
      question: question.question,
      standard_answer,
      // updated_at: question.updated_at,
    }

    await this._cacheService.set(cacheKey, result, this._cacheService.TTL.BIZ)
    return result
  }

  async saveStandardAnswer(dto: SaveStandardAnswerDto): Promise<string> {
    const { id, standard_answer, category, question } = dto

    await safePrisma.$transaction(async (tx) => {
      await this.saveQuestionBase(tx, id, category, question)
      await tx.standard_answers.deleteMany({ where: { question_id: id } })
      await this.saveStandardAnswerData(tx, id, standard_answer)
    })

    await this.clearQuestionCache()
    console.log(`🗑️ 已清空题目缓存`)

    return '标准答案保存成功'
  }

  private async getQuestionById(id: string): Promise<Question> {
    const question = await safePrisma.questions.findUnique({
      where: { id },
    })

    if (!question) {
      throw new HttpException('题目不存在', HttpStatus.NOT_FOUND)
    }
    return question
  }

  private async getStandardAnswer(questionId: string): Promise<string> {
    const standardList = await safePrisma.standard_answers.findMany({
      where: { question_id: questionId },
    })
    return standardList.length > 0 ? standardList[0].answer : ''
  }

  private async getAnswers(questionId: string): Promise<Answer[]> {
    const answersList = await safePrisma.interviewee_answers.findMany({
      where: { question_id: questionId },
      orderBy: { id: 'asc' },
    })

    return answersList.map((a) => ({
      name: a.name,
      score: a.score,
      evaluation: a.evaluation,
      answer: a.answer,
    }))
  }

  private async saveQuestionBase(
    tx: Prisma.TransactionClient,
    id: string,
    category?: string,
    question?: string,
  ): Promise<void> {
    const exists = await tx.questions.findUnique({ where: { id } })

    if (exists) {
      const updateData: Prisma.questionsUpdateInput = {}
      if (category !== undefined) updateData.category = category
      if (question !== undefined) updateData.question = question

      if (Object.keys(updateData).length > 0) {
        await tx.questions.update({
          where: { id },
          data: updateData,
        })
      } else {
        // 主表没数据更新无法触发更新时间，手动更新 updated_at 字段
        await tx.questions.update({
          where: { id },
          data: { updated_at: new Date() },
        })
      }
    } else {
      await tx.questions.create({
        data: {
          id,
          category: category || '',
          question: question || '',
        },
      })
    }
  }

  private async saveStandardAnswerData(
    tx: Prisma.TransactionClient,
    questionId: string,
    standard_answer?: string,
  ): Promise<void> {
    if (standard_answer) {
      await tx.standard_answers.create({
        data: {
          question_id: questionId,
          answer: standard_answer,
        },
      })
    }
  }

  private async saveAnswersData(
    tx: Prisma.TransactionClient,
    questionId: string,
    answers?: Answer[],
  ): Promise<void> {
    if (answers && answers.length > 0) {
      const answersData = answers.map((a) => ({
        question_id: questionId,
        name: a.name,
        score: a.score !== null && a.score !== undefined ? Number(a.score) : null,
        evaluation: a.evaluation,
        answer: a.answer,
      }))
      await tx.interviewee_answers.createMany({
        data: answersData,
      })
    }
  }

  private async clearQuestionCache(): Promise<void> {
    await this._cacheService.clearByPrefix(`${this._cacheService.PREFIX.BIZ}question:`)
  }
}
