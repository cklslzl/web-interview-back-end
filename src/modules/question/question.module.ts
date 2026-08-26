// 路径：src/modules/question/question.module.ts
import { Module } from '@nestjs/common';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { AppCacheModule } from '@/common/cache/cache.module';

@Module({
  imports: [AppCacheModule],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}