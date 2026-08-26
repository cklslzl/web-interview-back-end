// src/common/configs/database.config.ts
import { LogLevel } from '@/types/index'

// 连接重试计数器
export const MAX_RETRY = 3

// 从环境变量获取连接字符串
export const DATABASE_URL = process.env.DATABASE_URL || ''

const LOG_MAP = new Map<string, LogLevel[]>([
  ['development', ['query', 'info', 'warn', 'error']],
  ['production', ['error']],
  ['test', ['error']],
])

// 获取当前环境的数据库日志配置
export const DATABASE_LOG: LogLevel[] = LOG_MAP.get(process.env.NODE_ENV || 'development') || ['error']