
// 文件路径：src/common/utils/response.ts
import { ApiResponse } from '@/types/common.types';
// 统一返回格式
export function success<T = null>(data: T | null = null, msg = 'success'): ApiResponse<T | null> {
  return { code: 200, msg, data };
}

export function error(code = 500, msg = '服务器错误'): ApiResponse<null> {
  return { code, msg, data: null };
}