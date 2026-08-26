// src/common/configs/redis.config.ts
export const redisConfig = {
  host: '127.0.0.1',
  port: 6379,
  password: '', // 默认没有密码
  db: 0,
};

// 缓存前缀配置
export const CACHE_PREFIX = {
  GLOBAL: 'global:',
  BASE: 'base:',
  BIZ: 'biz:',
} as const;

// 缓存有效期配置（毫秒）
export const CACHE_TTL = {
  GLOBAL: 30 * 60 * 1000, // 30 分钟
  BASE: 60 * 60 * 1000,  // 1 小时
  BIZ: 10 * 60 * 1000,   // 10 分钟
} as const;