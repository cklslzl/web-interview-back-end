/*
  ================================
  知识点：NestJS 任务调度（Schedule / Cron 定时任务）
  ================================

  1. 核心概念
     - 基于 @nestjs/schedule 实现后台自动化定时任务，支持 Cron 表达式精准调度
     - 无需前端触发，服务启动后自动按规则运行
     - 结合全局分级缓存，实现：高频缓存(菜单)、中频缓存(基础数据)、低频缓存(全局配置)
     - 支持：服务启动预热、定时清理、兜底刷新、队列历史清理

  2. 核心语法（@Cron 标准规则）
     表达式顺序：秒 分 时 日 月 周
     格式：* * * * * *
     示例：
     @Cron('0 *\/10 * * * *') → 每 10 分钟执行一次
     @Cron('0 0 * * * *')    → 每小时整点执行
     @Cron('0 0 2 * * *')    → 每日凌晨 2 点执行
     @Cron('0 30 2 * * *')   → 每日凌晨 2 点 30 分执行

  3. 支持的装饰器
     - @Cron()        → 基于 Cron 表达式的定时任务
     - @Timeout()     → 延迟 N 毫秒执行一次
     - @Interval()    → 每隔 N 毫秒循环执行

  4. 优点
     - 注解式开发，与 Nest 依赖注入无缝集成
     - 精准 Cron 定时，支持复杂时间规则
     - 统一调度管理，支持多任务
     - 异步非阻塞，不影响主业务
     - 可配合 Redis 实现分布式锁

  5. 缺点
     - 多实例部署必须加分布式锁，防止重复执行
     - 定时任务必须异步，禁止同步阻塞

  6. 应用场景
     - 菜单缓存：高频兜底刷新
     - 字典/权限：中频定时清理
     - 全局配置：低频每日更新
     - 服务启动：缓存预热
     - 队列系统：清理历史任务，防止 Redis 膨胀

  7. 核心易错点
     - Cron 顺序：秒 分 时 日 月 周（与 Linux 不同）
     - 必须使用 async/await，禁止同步任务
     - 多实例部署会重复执行，需分布式锁控制
     - 任务异常必须捕获，避免崩溃

  8. 最佳实践
     - 增删改操作 → 立即清理对应缓存（第一优先级）
     - 定时任务 → 仅做兜底刷新
     - 按业务频率分级设置定时周期
     - 所有任务独立捕获异常，不互相影响
     - 定期清理队列历史数据，保护 Redis

  9. 与原生 ES6+ 定时器区别
     - setInterval：无精准定时、无依赖注入、无统一管理
     - Nest Schedule：标准 Cron、DI 集成、可观测、可动态管理
*/

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CacheService } from '@/common/cache/cache.service';
import { redisConfig } from '@/common/configs/redis.config';
import { Queue } from 'bullmq';
import { safePrisma } from '@/common/utils/index';
import type { MenuItem } from '@/modules/menu/types/menu.types';

@Injectable()
export class ScheduleTaskService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduleTaskService.name);
  private warmUpTimer: NodeJS.Timeout | null = null;

  /*
    工作流程说明：
    1. 定义需要自动清理的 BullMQ 队列名称
    2. 用于定时任务自动清理历史数据
  */
  private readonly queueNames: readonly string[] = ['biz-menu-sync'];

  constructor(
    private readonly _cacheService: CacheService,
  ) {}

  /**
   * 模块初始化
   * 工作流程：
   * 1. 清理可能存在的旧定时器（防止热更新重复）
   * 2. 延迟 3s 执行菜单缓存预热
   */
  onModuleInit(): void {
    this.clearExistingTimer();
    this.warmUpTimer = setTimeout(() => {
      void this.warmUpMenuCacheOnStart();
    }, 3000);
  }

  /**
   * 模块销毁时清理资源
   */
  onModuleDestroy(): void {
    this.clearExistingTimer();
  }

  /**
   * 统一清理预热定时器
   */
  private clearExistingTimer(): void {
    if (this.warmUpTimer) {
      clearTimeout(this.warmUpTimer);
      this.warmUpTimer = null;
    }
  }

  // ================================
  // 分级缓存定时清理任务
  // ================================

  /*
    @Cron('0 *\/10 * * * *')
    含义：每 10 分钟执行一次
    作用：清理高频变化的菜单缓存
  */
  @Cron('0 */10 * * * *')
  async clearMenuCache(): Promise<void> {
    try {
      await this._cacheService.clearByPrefix(`${this._cacheService.PREFIX.BIZ}menu:`);
      this.logger.log('✅ 定时任务：菜单缓存已兜底清理');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.error('❌ 菜单缓存清理失败', message);
    }
  }

  /*
    @Cron('0 *\/5 * * * *')
    含义：每 5 分钟执行一次
    作用：清理过期的 key，防止缓存填满
  */
  @Cron('0 */5 * * * *')
  async cleanExpiredKeys(): Promise<void> {
    try {
      const cleanedCount = await this._cacheService.cleanExpiredKeys();
      if (cleanedCount > 0) {
        this.logger.log(`✅ 定时任务：已清理 ${cleanedCount} 个过期缓存 key`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.error('❌ 清理过期 key 失败', message);
    }
  }

  /*
    @Cron('0 0 * * * *')
    含义：每小时 0 分 0 秒执行一次（整点执行）
    作用：清理基础数据（字典、分类、权限）
  */
  @Cron('0 0 * * * *')
  async clearBaseCache(): Promise<void> {
    try {
      await this._cacheService.clearBaseCache();
      this.logger.log('✅ 定时任务：基础数据缓存已清理');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.error('❌ 基础数据缓存清理失败', message);
    }
  }

  /*
    @Cron('0 0 2 * * *')
    含义：每天凌晨 2:00 执行
    作用：清理全局配置（最低频）
  */
  @Cron('0 0 2 * * *')
  async clearGlobalCache(): Promise<void> {
    try {
      await this._cacheService.clearGlobalCache();
      this.logger.log('✅ 定时任务：全局配置缓存已清理');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.error('❌ 全局配置缓存清理失败', message);
    }
  }

  // ================================
  // 每日清理 BullMQ 队列历史数据
  // ================================

  /*
    @Cron('0 30 2 * * *')
    含义：每天凌晨 2:30 执行
    作用：清理 BullMQ 3 天前的历史任务，避免 Redis 无限膨胀
  */
  @Cron('0 30 2 * * *')
  async cleanBullMqHistory(): Promise<void> {
    this.logger.log('🧹 开始清理 BullMQ 队列历史数据');

    for (const name of this.queueNames) {
      try {
        const queue = new Queue(name, { connection: redisConfig });

        // 清理 3 天前的任务，每种状态最多保留 100 条
        await queue.clean(259200000, 100, 'completed');
        await queue.clean(259200000, 100, 'failed');
        await queue.clean(259200000, 100, 'delayed');
        await queue.clean(259200000, 100, 'wait');
        await queue.clean(259200000, 100, 'paused');

        await queue.close();
        this.logger.log(`✅ 队列【${name}】历史清理完成`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        this.logger.error(`❌ 队列【${name}】清理失败`, message);
      }
    }

    this.logger.log('✅ 所有队列历史清理完成');
  }

  // ================================
  // 服务启动：菜单缓存预热
  // ================================

  /**
   * 工作流程：
   * 1. 服务启动后自动加载常用菜单
   * 2. 一次性查询所有菜单，在内存中构建树形结构
   * 3. 加载完成直接写入 Redis
   * 4. 首次访问瞬间响应
   */
  async warmUpMenuCacheOnStart(): Promise<void> {
    this.logger.log('🚀 服务启动：开始预加载菜单缓存');

    const categories: readonly string[] = ['node-web', 'scss'];

    for (const category of categories) {
      try {
        await this.loadSingleMenu(category);
        this.logger.log(`✅ 菜单预热完成：${category}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        this.logger.error(`❌ 菜单预热失败：${category}`, message);
      }

      // 每个菜单间隔 2s，保护数据库
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    this.logger.log('✅ 全部菜单缓存预热完成');
  }

  /**
   * 🔥 使用 Prisma 一次性查询所有菜单，在内存中构建树形结构
   * 只需 1 次数据库查询，避免递归占用连接池
   */
  private async loadSingleMenu(category: string): Promise<void> {
    // 一次性查询该分类下的所有菜单
    const allMenus = await safePrisma.web_menu_list.findMany({
      where: { category },
      orderBy: { sort: 'asc' },
    });

    // 在内存中构建树形结构
    const menuMap = new Map<string, MenuItem>();
    const rootMenus: MenuItem[] = [];

    // 第一遍：创建所有菜单节点
    for (const menu of allMenus) {
      menuMap.set(menu.menu_id, {
        id: menu.menu_id,
        path: menu.path,
        name: menu.name,
        title: menu.title,
        category: menu.category,
        children: [],
      });
    }

    // 第二遍：构建树形结构
    for (const menu of allMenus) {
      const node = menuMap.get(menu.menu_id)!;
      if (menu.parent_id === '0') {
        rootMenus.push(node);
      } else {
        const parent = menuMap.get(menu.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      }
    }

    const cacheKey = `${this._cacheService.PREFIX.BIZ}menu:${category}`;
    await this._cacheService.set(cacheKey, rootMenus, this._cacheService.TTL.BIZ);
  }
}
