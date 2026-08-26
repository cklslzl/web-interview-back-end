// 用户基础信息
export interface UserBase {
  userId: string
  username: string
  role: string
  email: string
}

// JWT 载荷（继承用户信息 + 过期时间）
export interface JwtPayload extends UserBase {
  iat: number
  exp: number
}

// 自定义带 user 的 Request 类型
export interface RequestWithUser {
  user: JwtPayload
  headers: Record<string, string | string[] | undefined>
}
