// 路径：src/modules/question/question.controller.ts
import { Controller, Get, Post, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@/types/common.types';
import { Question, QuestionsResponse, QuestionDetail, StandardAnswerResponse, SaveStandardAnswerDto } from './types/question.types';
import { success, error } from '@/common/utils/response';
import { QuestionService } from './question.service';

@Controller('questions')
export class QuestionController {
  constructor(private readonly _questionService: QuestionService) {}

  // 1. 获取题目列表（模糊查询 + 分类 + 分页）
  @Get('list')
  async getQuestionList(
    @Query('question') question?: string,
    @Query('category') category?: string,
    @Query('pageNum') pageNum?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ApiResponse<QuestionsResponse | null>> {
    try {
      const result = await this._questionService.getQuestionList(question, category, pageNum, pageSize);
      return success(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : '服务器错误';
      return error(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }
  }

  // 2. 获取题目详情
  @Get('detail')
  async getQuestionDetail(
    @Query('id') id: string,
  ): Promise<ApiResponse<QuestionDetail | null>> {
    try {
      if (!id) throw new HttpException('缺少参数 id', HttpStatus.BAD_REQUEST);
      const data = await this._questionService.getQuestionDetail(id);
      return success(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : '服务器错误';
      return error(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }
  }

  // 3. 批量保存题目
  @Post('batch-save')
  async batchSaveQuestions(
    @Body() list: Question[],
  ): Promise<ApiResponse<null>> {
    try {
      if (!Array.isArray(list)) {
        throw new HttpException('参数必须是数组', HttpStatus.BAD_REQUEST);
      }
      const msg = await this._questionService.batchSaveQuestions(list);
      return success(null, msg);
    } catch (e) {
      const message = e instanceof Error ? e.message : '服务器错误';
      return error(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }
  }

  // 4. 保存题目详情
  @Post('save-detail')
  async saveQuestionDetail(
    @Body() body: QuestionDetail,
  ): Promise<ApiResponse<null>> {
    try {
      const msg = await this._questionService.saveQuestionDetail(body);
      return success(null, msg);
    } catch (e) {
      const message = e instanceof Error ? e.message : '服务器错误';
      return error(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }
  }

  // 5. 获取标准答案
  @Get('standard-answer')
  async getStandardAnswer(
    @Query('id') id: string,
  ): Promise<ApiResponse<StandardAnswerResponse | null>> {
    try {
      if (!id) throw new HttpException('缺少参数 id', HttpStatus.BAD_REQUEST);
      const data = await this._questionService.getStandardAnswerOnly(id);
      return success(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : '服务器错误';
      return error(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }
  }

  // 6. 保存标准答案
  @Post('save-standard-answer')
  async saveStandardAnswer(
    @Body() body: SaveStandardAnswerDto,
  ): Promise<ApiResponse<null>> {
    try {
      if (!body.id) throw new HttpException('缺少参数 id', HttpStatus.BAD_REQUEST);
      const msg = await this._questionService.saveStandardAnswer(body);
      return success(null, msg);
    } catch (e) {
      const message = e instanceof Error ? e.message : '服务器错误';
      return error(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }
  }
}