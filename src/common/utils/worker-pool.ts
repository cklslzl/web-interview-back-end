// 文件路径： src/common/utils/worker-pool.ts
import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import { WorkerTask, WorkerMeta, Message } from '@/types/pool.types';
import { EventEmitter } from 'events';

// ==================== 配置 ====================
export const DEFAULT_POOL_CONFIG = {
  MAX_SIZE: 4,
  IDLE_TIMEOUT: 10000,
  TASK_TIMEOUT: 30000,
  MAX_QUEUE: 50, // ✅ 增大队列上限（你要的）
};

// ==================== 泛型线程池（无 any） ====================
export class UniversalWorkerPool {
  private readonly activeWorkers = new Map<symbol, WorkerMeta>();
  private readonly taskQueue: WorkerTask[] = [];
  private readonly workerPath: string;
  private readonly config = DEFAULT_POOL_CONFIG;

  constructor(workerPath: string) {
    this.workerPath = workerPath;
    // ✅ 全局增加 EventEmitter 最大监听器数量（解决警告）
    EventEmitter.defaultMaxListeners = 20;
  }

  /**
   * 执行任务（泛型，无 any）
   */
  public run<T>(
    data: T,
    callback: (_result: unknown, _error?: string) => void,
    priority = 1
  ): string {
    const requestId = randomUUID().slice(0, 8);

    if (this.taskQueue.length >= this.config.MAX_QUEUE) {
      callback(null, '系统繁忙，队列已满');
      return requestId;
    }

    const task: WorkerTask<T> = {
      requestId,
      data,
      callback,
      priority,
    };

    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => a.priority - b.priority);
    this.processNextTask();

    return requestId;
  }

  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;

    const task = this.taskQueue.shift()!;
    const idleWorker = this.getIdleWorker();

    if (idleWorker) {
      this.runWorker(idleWorker, task);
      return;
    }

    if (this.activeWorkers.size < this.config.MAX_SIZE) {
      this.createWorker(task);
      return;
    }

    this.taskQueue.unshift(task);
  }

  private getIdleWorker(): WorkerMeta | null {
    for (const meta of this.activeWorkers.values()) {
      if (meta.timeoutId) return meta;
    }
    return null;
  }

  private createWorker(task: WorkerTask): void {
    const workerId = Symbol(`worker-${Date.now()}`);
    const worker = new Worker(this.workerPath);

    // ✅ 给每个 worker 单独设置最大监听器
    worker.setMaxListeners(15);

    const meta: WorkerMeta = { id: workerId, worker };
    this.activeWorkers.set(workerId, meta);
    this.runWorker(meta, task);
  }

  private runWorker(meta: WorkerMeta, task: WorkerTask): void {
    const { data, callback } = task;

    if (meta.timeoutId) {
      clearTimeout(meta.timeoutId);
      meta.timeoutId = undefined;
    }

    const timeout = setTimeout(() => {
      callback(null, '任务超时');
      this.cleanupListeners(meta); // ✅ 清理监听器
      this.completeWorker(meta);
    }, this.config.TASK_TIMEOUT);

    // ✅ 使用 once 确保自动销毁
    const onMessage = (msg: Message) => {
      clearTimeout(timeout);
      if (msg.type === 'RESULT') {
        callback(msg.data);
      } else if (msg.type === 'ERROR') {
        callback(null, msg.error);
      } else {
        callback(null, '未知消息类型');
      }
      this.cleanupListeners(meta);
      this.completeWorker(meta);
    };

    const onError = (err: Error) => {
      clearTimeout(timeout);
      callback(null, err.message);
      this.cleanupListeners(meta);
      this.completeWorker(meta);
    };

    meta.worker.once('message', onMessage);
    meta.worker.once('error', onError);

    meta.worker.postMessage(data);
  }

  // ✅ 新增：安全清理监听器
  private cleanupListeners(meta: WorkerMeta): void {
    meta.worker.removeAllListeners('message');
    meta.worker.removeAllListeners('error');
  }

  private completeWorker(meta: WorkerMeta): void {
    meta.timeoutId = setTimeout(() => {
      this.destroyWorker(meta);
    }, DEFAULT_POOL_CONFIG.IDLE_TIMEOUT);
    this.processNextTask();
  }

  private destroyWorker(meta: WorkerMeta): void {
    if (!this.activeWorkers.has(meta.id)) return;
    this.cleanupListeners(meta); // ✅ 销毁前清理
    meta.worker.terminate().catch(() => undefined);
    this.activeWorkers.delete(meta.id);
    this.processNextTask();
  }
}