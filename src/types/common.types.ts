// 文件路径： src/types/common.types.ts

interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export type {
  ApiResponse
};