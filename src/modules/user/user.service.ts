// 文件路径： src/modules/user/user.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as crypto from 'crypto'
import * as nodemailer from 'nodemailer'
import { safePrisma } from '@/common/utils/index'
import { EMAIL_CONFIG } from '@/common/configs/email.config'
import { RedisService } from '@/common/redis/redis.service'
import { JwtPayload, UserBase } from '@/types/index'

@Injectable()
export class UserService {
  constructor(
    private readonly _redisService: RedisService,
    private readonly _jwtService: JwtService,
  ) {}

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  private encryptPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex')
  }

  private async sendEmail(toEmail: string, code: string) {
    const transporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      secure: EMAIL_CONFIG.secure,
      auth: EMAIL_CONFIG.auth,
    })

    await transporter.sendMail({
      from: `"系统注册" <${EMAIL_CONFIG.from}>`,
      to: toEmail,
      subject: '注册验证码',
      html: `<h2>您的验证码：${code}</h2><p>10分钟内有效，请勿泄露</p>`,
    })
  }

  async sendEmailCode(email: string) {
    if (!email) throw new HttpException('邮箱不能为空', HttpStatus.BAD_REQUEST)
    const exists = await safePrisma.users.findUnique({ where: { email } })
    if (exists) throw new HttpException('该邮箱已注册，请直接登录', HttpStatus.BAD_REQUEST)

    const code = this.generateCode()
    await this.sendEmail(email, code)

    await safePrisma.email_codes.create({
      data: {
        email,
        code,
        type: 'register',
        used: 0,
        expired_at: new Date(Date.now() + 10 * 60 * 1000),
      },
    })
  }

  async register(body: {
    username: string
    password: string
    phone: string
    email: string
    code: string
  }) {
    const { username, password, phone, email, code } = body

    const codeRecord = await safePrisma.email_codes.findFirst({
      where: { email, code, used: 0, expired_at: { gt: new Date() } },
      orderBy: { id: 'desc' },
    })
    if (!codeRecord) throw new HttpException('验证码错误或已过期', 400)

    const [existUser, existPhone, existEmail] = await Promise.all([
      safePrisma.users.findUnique({ where: { username } }),
      safePrisma.users.findUnique({ where: { phone } }),
      safePrisma.users.findUnique({ where: { email } }),
    ])
    if (existUser) throw new HttpException('用户名已存在', 400)
    if (existPhone) throw new HttpException('手机号已被注册', 400)
    if (existEmail) throw new HttpException('邮箱已被注册', 400)

    await safePrisma.users.create({
      data: {
        username,
        password: this.encryptPassword(password),
        phone,
        email,
        role: 'user',
        status: 1,
      },
    })

    await safePrisma.email_codes.update({
      where: { id: codeRecord.id },
      data: { used: 1 },
    })
    return '注册成功'
  }

  async login(username: string, password: string) {
    const user = await safePrisma.users.findFirst({
      where: { username, status: 1 },
    })
    if (!user) throw new HttpException('用户不存在或已禁用', 400)

    const encrypted = this.encryptPassword(password)
    if (user.password !== encrypted) throw new HttpException('密码错误', 400)

    // 颁发JWT
    const token = await this._jwtService.signAsync({
      userId: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
    })

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    }
  }

  /**
   * 退出登录（企业级标准：可扩展黑名单，当前返回成功即可）
   */
  async logout(token: string, user: UserBase): Promise<string> {
    try {
      const decoded = this._jwtService.decode<JwtPayload>(token)
      const now = Math.floor(Date.now() / 1000)
      const ttl = decoded.exp - now

      if (ttl > 0) {
        await this._redisService.set(`black:token:${token}`, user.userId, ttl)
        console.log('✅ 已写入黑名单，key:', `black:token:${token}`)
        console.log('✅ 剩余有效期:', ttl, '秒')
      }

      return '退出成功，token 已失效'
    } catch (err) {
      console.error('❌ 写入黑名单失败:', err)
      throw new HttpException('退出失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
