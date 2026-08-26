import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { UserBase } from '@/types/index'

export const User = createParamDecorator(
  (data: keyof UserBase | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest()
    const user = req.user

    if (!user) {
      throw new UnauthorizedException('用户未登录')
    }

    return data ? user[data] : user
  },
)
