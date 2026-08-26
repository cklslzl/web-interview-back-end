import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { JWT_CONFIG } from '../configs/jwt.config'
import { RedisService } from '../redis/redis.service'
import { JwtPayload } from '@/types/index'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly _jwtService: JwtService,
    private readonly _redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const authHeader = req.headers.authorization

    /**
     * 1. 规范校验：必须存在 Authorization 请求头
     * 前端必须传递：Authorization: Bearer 你的token
     */
    if (!authHeader) {
      throw new UnauthorizedException('未登录，请先登录')
    }

    /**
     * 2. 行业标准规范：
     * 必须以 Bearer 开头，严格拆分 token
     * 格式错误直接判定未登录
     */
    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('登录凭证格式错误')
    }

    const token = parts[1]

    /**
     * 3. 先校验 Redis 黑名单（登出过的token直接拦截）
     */
    const isBlack = await this._redisService.get(`black:token:${token}`)
    if (isBlack) {
      throw new UnauthorizedException('您已登出，请重新登录')
    }

    /**
     * 4. 校验 JWT 合法性：签名、过期时间、密钥
     */
    let payload: JwtPayload
    try {
      payload = await this._jwtService.verifyAsync<JwtPayload>(token, {
        secret: JWT_CONFIG.secret,
      })
    } catch (err) {
      console.error('JWT 校验失败')
      const errorMsg = err instanceof Error ? err.message : 'unknown error'
      if (errorMsg.includes('invalid signature')) {
        throw new UnauthorizedException('登录凭证已失效，请重新登录')
      }
      if (errorMsg.includes('jwt expired')) {
        throw new UnauthorizedException('登录凭证已过期，请重新登录')
      }
      throw new UnauthorizedException('登录凭证无效，请重新登录')
    }

    /**
     * 5. 校验通过，将用户信息挂载到 request
     * 供 @User() 装饰器使用
     */
    req.user = payload
    return true
  }
}
