// src/app.module.ts
import { Module } from '@nestjs/common'
import { AppController } from '@/app.controller'
import { AppCacheModule } from '@/common/cache/cache.module'
import { TaskScheduleModule } from '@/common/schedule/schedule.module'
import { BullModule } from '@nestjs/bullmq'
import { redisConfig } from '@/common/configs/redis.config'
import { MenuModule } from '@/modules/menu/menu.module'
import { QuestionModule } from '@/modules/question/question.module'
import { UserModule } from '@/modules/user/user.module'
import { RedisModule } from '@/common/redis/redis.module'

@Module({
  imports: [
    // 全局配置 Redis
    BullModule.forRoot({
      connection: redisConfig,
    }),
    AppCacheModule,
    MenuModule,
    QuestionModule,
    UserModule,
    RedisModule,
    TaskScheduleModule,
  ],
  // 所有“路由/控制器”都写在这里 = 原来的 router.use
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
