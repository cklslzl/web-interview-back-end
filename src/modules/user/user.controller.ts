import { Controller, Post, Body, HttpStatus, UseGuards, Headers } from '@nestjs/common'
import { UserService } from './user.service'
import { success, error } from '@/common/utils/response'
import { AuthGuard } from '@/common/guards/auth.guard'
import { User } from '@/common/decorators/user.decorator'
import { UserBase } from '@/types/index'

@Controller('user')
export class UserController {
  constructor(private readonly _userService: UserService) {}

  // 1. 发送邮箱验证码
  @Post('send-email-code')
  async sendEmailCode(@Body() body: { email: string }) {
    try {
      await this._userService.sendEmailCode(body.email)
      return success(null, '验证码发送成功')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '发送失败'
      return error(HttpStatus.BAD_REQUEST, msg)
    }
  }

  // 2. 用户注册（邮箱验证码）
  @Post('register')
  async register(
    @Body()
    body: {
      username: string
      password: string
      phone: string
      email: string
      code: string
    },
  ) {
    try {
      await this._userService.register(body)
      return success(null, '注册成功')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '注册失败'
      return error(HttpStatus.BAD_REQUEST, msg)
    }
  }

  // 3. 登录
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    try {
      const token = await this._userService.login(body.username, body.password)
      return success(token, '登录成功')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '登录失败'
      return error(HttpStatus.BAD_REQUEST, msg)
    }
  }

  /**
   * 登出接口（token 加入黑名单）
   * 流程：
   * 1. 从请求头 Authorization 中获取 token
   * 2. 提取纯 token（去掉 Bearer 前缀）
   * 3. 调用 service 将 token 存入 Redis 黑名单（有效期 = token 剩余有效期）
   * 4. 返回登出成功，该 token 后续无法再使用
   */
  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(
    @Headers('authorization') authHeader: string, // ✅ 正确写法
    @User() user: UserBase,
  ) {
    try {
      const token = authHeader.split(' ')[1] // ✅ 安全提取
      const msg = await this._userService.logout(token, user)
      return success(null, msg)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '退出失败'
      return error(HttpStatus.BAD_REQUEST, msg)
    }
  }
}
