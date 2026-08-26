// 文件路径：src/common/utils/process-pool.ts
import { fork, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import type { ProcessTask, Message } from '@/types/pool.types';

export class UniversalProcessPool {
  private pool: ChildProcess[] = [];
  private idleProcesses: Set<ChildProcess> = new Set();
  private taskQueue: ProcessTask[] = [];

  private readonly workerPath: string;
  private readonly poolSize: number;
  private readonly taskTimeout: number;

  constructor(
    workerPath: string,
    poolSize = 4,
    taskTimeout = 10000
  ) {
    this.workerPath = workerPath;
    this.poolSize = poolSize;
    this.taskTimeout = taskTimeout;
    this.initPool();
  }

  private initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      this.createProcess();
    }
  }

  private createProcess() {
    const p = fork(this.workerPath, [], {
      execArgv: process.env.NODE_ENV === 'production' ? [] : ['-r', 'ts-node/register'],
      env: process.env,
    });

    console.log(`[进程池] 创建 PID: ${p.pid}`);

    p.on('exit', (code) => {
      console.warn(`[进程池] 退出 PID: ${p.pid}, 码: ${code}`);
      this.pool = this.pool.filter(item => item !== p);
      this.idleProcesses.delete(p);
      setTimeout(() => this.createProcess(), 200);
    });

    p.on('error', (err) => {
      console.error(`[进程池] 错误 PID: ${p.pid}`, err);
    });

    p.on('message', (msg: Message) => {
      if (msg.type === 'READY') {
        this.idleProcesses.add(p);
        this.schedule();
      }
    });

    this.pool.push(p);
  }

  public run<T>(
    data: T,
    callback: ProcessTask['callback']
  ): string {
    const id = randomUUID().slice(0, 6);
    const task: ProcessTask<T> = { id, data, callback };
    this.taskQueue.push(task);
    this.schedule();
    return id;
  }

  private schedule() {
    if (this.taskQueue.length === 0 || this.idleProcesses.size === 0) return;

    const task = this.taskQueue.shift()!;
    const p = this.idleProcesses.values().next().value;
    if (!p) return;

    this.idleProcesses.delete(p);
    this.execute(p, task);
  }

  private execute(p: ChildProcess, task: ProcessTask) {
    const { data, callback } = task;

    const timeout = setTimeout(() => {
      callback(undefined, '执行超时', p.pid);
      this.idleProcesses.add(p);
    }, this.taskTimeout);

    p.once('message', (msg: Message) => {
      clearTimeout(timeout);
      this.idleProcesses.add(p);
      this.schedule();

      // ---------------- 🔥 修复关键：类型守卫 ----------------
      if (msg.type === 'RESULT') {
        callback(msg.data, undefined, p.pid);
      } else if (msg.type === 'ERROR') {
        callback(undefined, msg.error, p.pid);
      }
      // 忽略 READY 消息
    });

    p.send({ type: 'CALCULATE_SUM', payload: data });
  }
}