// 文件路径：src/common/constants/app.constant.ts
/**
 * 应用全局配置
 * 统一管理：项目信息、全局常量
 */

// 获取环境变量
const env = process.env
const NODE_ENV = env.NODE_ENV || 'development'
console.log('src/configs/app.ts 中获取NODE_ENV：', NODE_ENV)
// 应用名称
const APP_NAME = 'nestjs'

const VERSION = '1.0.0'

const DEFAULT_TITLE = env.VITE_APP_TITLE || APP_NAME

const OTHER_SERVICE_BASE_URL = env.OTHER_SERVICE_BASE_URL || ''

const PORT = env.PORT || 3000

export {
  APP_NAME,
  VERSION,
  DEFAULT_TITLE,
  OTHER_SERVICE_BASE_URL,
  NODE_ENV,
  PORT,
}