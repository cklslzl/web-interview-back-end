// 文件路径：src/common/constants/api.constant.ts
/**
 * 业务接口地址常量
 * 统一管理所有接口路径，杜绝硬编码
 */
import { OTHER_SERVICE_BASE_URL } from './app.constant'
export const API_URL = {
  MENU_LIST: `${OTHER_SERVICE_BASE_URL}/api/menu/list`,
  QUESTIONS: `${OTHER_SERVICE_BASE_URL}/api/questions`,
} as const