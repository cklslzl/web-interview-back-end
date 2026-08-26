// 文件路径：src/types/pool.types.ts
import type { Worker } from 'worker_threads';

// ==============================
// 🔥 公共基础类型
// ==============================
export type MessageType = 'READY' | 'RESULT' | 'ERROR';

// 通用成功消息
export interface SuccessMessage<T = unknown> {
  type: 'RESULT';
  data: T;
}

// 通用错误消息
export interface ErrorMessage {
  type: 'ERROR';
  error: string;
}

// 通用就绪消息
export interface ReadyMessage {
  type: 'READY';
}

// 🔥 最终统一消息（所有池共用）
export type Message<T = unknown> = 
  | ReadyMessage 
  | SuccessMessage<T> 
  | ErrorMessage;

// 通用任务请求
export interface TaskRequest<T = unknown> {
  type: 'CALCULATE_SUM';
  payload: T;
}

// ==============================
// 🌐 线程池类型
// ==============================
export interface WorkerTask<T = unknown> {
  requestId: string;
  data: T;
  callback: (_result: unknown, _error?: string) => void;
  priority: number;
}

export interface WorkerMeta {
  id: symbol;
  worker: Worker;
  timeoutId?: NodeJS.Timeout;
}

// ==============================
// 🖥️ 进程池类型
// ==============================
export interface ProcessTask<T = unknown> {
  id: string;
  data: T;
  callback: (
    _result: unknown,
    _error?: string,
    _pid?: number
  ) => void;
}