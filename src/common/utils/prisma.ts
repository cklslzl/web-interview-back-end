// src/common/utils/prisma.ts - Prisma 安全查询服务

import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { MAX_RETRY, DATABASE_URL, DATABASE_LOG } from '@/common/configs/database.config'

class PrismaService {
  private client: PrismaClient
  private retryCount: number = 0
  private readonly MAX_RETRY: number = MAX_RETRY

  constructor() {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL 环境变量缺失，请检查 .env 文件')
    }
    this.client = this.createClient(DATABASE_URL)
    this.setupCleanupHandlers()
  }

  private createClient(DATABASE_URL: string): PrismaClient {
    const adapter = new PrismaMariaDb(DATABASE_URL)
    return new PrismaClient({
      adapter,
      log: DATABASE_LOG,
    })
  }

  private isConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return (
      message.includes('pool timeout') ||
      message.includes('connection timeout') ||
      message.includes('connection refused') ||
      message.includes('lost connection') ||
      message.includes("can't connect")
    )
  }

  private async reconnect(DATABASE_URL: string): Promise<void> {
    try {
      await this.client.$disconnect()
      console.log('✅ Prisma Client 已断开连接')

      this.client = this.createClient(DATABASE_URL)
      await this.client.$queryRaw`SELECT 1`
      console.log('✅ Prisma Client 重新连接成功')
    } catch (e) {
      console.error('❌ Prisma Client 重新连接失败:', e)
      throw e
    }
  }

  private setupCleanupHandlers(): void {
    process.on('SIGINT', async () => {
      console.log('🛑 收到 SIGINT，正在关闭 Prisma Client...')
      await this.client.$disconnect()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      console.log('🛑 收到 SIGTERM，正在关闭 Prisma Client...')
      await this.client.$disconnect()
      process.exit(0)
    })
  }

  private createSafeProxy<T extends object>(target: T): T {
    const self = this
    return new Proxy(target, {
      get(obj, prop) {
        const value = obj[prop as keyof typeof obj]
        if (typeof value === 'function') {
          return async function (...args: unknown[]) {
            let result: unknown
            try {
              result = await (value as (..._args: unknown[]) => Promise<unknown>).apply(obj, args)
            } catch (error) {
              if (self.isConnectionError(error) && self.retryCount < self.MAX_RETRY) {
                self.retryCount++
                console.error(
                  `⚠️ 数据库连接失败，正在尝试重新连接 (${self.retryCount}/${self.MAX_RETRY}):`,
                  error,
                )

                await self.reconnect(DATABASE_URL!)

                self.retryCount = 0
                result = await (
                  obj[prop as keyof typeof obj] as (..._args: unknown[]) => Promise<unknown>
                ).apply(obj, args)
              } else {
                self.retryCount = 0
                throw error
              }
            }
            self.retryCount = 0
            return result
          }
        } else if (typeof value === 'object' && value !== null) {
          return self.createSafeProxy(value as object)
        }
        return value
      },
    }) as T
  }

  get safePrisma(): PrismaClient {
    return this.createSafeProxy(this.client)
  }

  get prisma(): PrismaClient {
    return this.client
  }
}

export const prismaService = new PrismaService()
export const prisma = prismaService.prisma
export const safePrisma = prismaService.safePrisma
