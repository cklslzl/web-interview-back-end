// src/common/schedule/schedule.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduleTaskService } from '@/common/schedule/schedule.service';
import { AppCacheModule } from '@/common/cache/cache.module'; 

@Module({
  imports: [
    // 全局开启定时任务调度
    ScheduleModule.forRoot(),
    // 在此处导入，这样 TaskScheduleModule 内部的 Service 才能使用 AppCacheModule 导出的 Provider
    AppCacheModule,
  ],
  providers: [ScheduleTaskService],
  exports: [ScheduleTaskService],
})
export class TaskScheduleModule {}