import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig, CACHE_PREFIX, CACHE_TTL } from '@/common/configs/redis.config';

/**
 * 全局业务缓存服务
 * 分级缓存策略：
 * - global: 全局配置（几乎不变）
 * - base:   基础数据（字典、权限、分类）
 * - biz:    业务数据
 */
@Injectable()
export class CacheService implements OnModuleInit {
  private readonly redis = new Redis(redisConfig);
  // 使用 Set 存储所有缓存 key
  private keySet = new Set<string>();
  
  // 缓存前缀（全局统一）
  public readonly PREFIX = CACHE_PREFIX;
  // 缓存有效期
  public readonly TTL = CACHE_TTL;

  onModuleInit(): void {
    // 服务启动时同步 Redis 中的 key 到内存 keySet
    this.syncKeysFromRedis();
  }

  /**
   * 从 Redis 同步已有的 key 到内存 keySet
   */
  private async syncKeysFromRedis(): Promise<void> {
    try {
      // 获取所有 key 并加入 keySet
      const allKeys = await this.redis.keys('*');
      for (const key of allKeys) {
        this.keySet.add(key);
      }
      console.log(`✅ 已同步 ${allKeys.length} 个缓存 key 到内存`);
    } catch (error) {
      console.warn('⚠️ 同步 Redis key 失败，使用空 keySet:', error);
    }
  }

  // 设置缓存
  async set<T>(key: string, value: T, ttl = 300_000): Promise<void> {
    console.log('🔥 真实写入 Redis：', key);
    this.keySet.add(key);
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl / 1000);
      console.log('✅ Redis 缓存设置成功：', key);
    } catch (error) {
      console.error('❌ 缓存设置失败：', key, error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) {
      console.log('🔍 Redis 不存在：', key);
      // Redis 中不存在，从内存 keySet 中也移除
      this.keySet.delete(key);
      return null;
    }
    console.log('🔍 从 Redis 获取缓存：', key);
    return JSON.parse(data);
  }

  async del(key: string): Promise<void> {
    this.keySet.delete(key);
    await this.redis.del(key);
  }

  async clearBaseCache(): Promise<void> {
    await this.clearByPrefix(this.PREFIX.BASE);
  }

  async clearBizCache(): Promise<void> {
    await this.clearByPrefix(this.PREFIX.BIZ);
  }

  async clearGlobalCache(): Promise<void> {
    await this.clearByPrefix(this.PREFIX.GLOBAL);
  }

  async clearAll(): Promise<void> {
    this.keySet.clear();
    await this.redis.flushall();
  }

  /**
   * 清理过期 key（防止缓存填满）
   * 主动检查并删除内存 keySet 中已经在 Redis 过期的 key
   */
  async cleanExpiredKeys(): Promise<number> {
    let cleanedCount = 0;
    const keysToCheck = Array.from(this.keySet);
    
    for (const key of keysToCheck) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -2) {
        // key 不存在
        this.keySet.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 清理了 ${cleanedCount} 个过期 key，当前 keySet 大小: ${this.keySet.size}`);
    }
    
    return cleanedCount;
  }

  async clearByPrefix(prefix: string): Promise<void> {
    try {
      const keysToDelete = Array.from(this.keySet).filter(key => key.startsWith(prefix));
      for (const key of keysToDelete) {
        console.log('🗑️ 删除缓存：', key);
        await this.del(key);
      }
    } catch (e) {
      console.warn('清理缓存失败', e);
    }
  }
}