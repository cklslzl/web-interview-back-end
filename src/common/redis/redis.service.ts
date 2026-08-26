import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { redisConfig } from '../configs/redis.config'

@Injectable()
export class RedisService {
  public readonly client: Redis

  constructor() {
    this.client = new Redis(redisConfig)
  }

  /**
   * 设置缓存
   * @param key 键
   * @param value 值（string / number）
   * @param exSeconds 过期时间（秒）
   */
  async set(key: string, value: string | number, exSeconds?: number): Promise<'OK' | null> {
    if (exSeconds) {
      return this.client.set(key, value, 'EX', exSeconds)
    }
    return this.client.set(key, value)
  }

  /**
   * 获取缓存
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<number> {
    return this.client.del(key)
  }
}
