import { Global, Module } from '@nestjs/common'
import { RedisService } from './redis.service'

@Global() // 🔥 全局注册，所有模块直接用
@Module({
  providers: [RedisService],
  exports: [RedisService], // 🔥 必须导出
})
export class RedisModule {}
