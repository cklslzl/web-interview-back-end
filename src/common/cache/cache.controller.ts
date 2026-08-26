/*
  通用缓存管理接口
  作用：统一提供缓存刷新、清理、查询能力，支持所有业务模块
*/
import { Controller, Post, Body } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';
import { success, error } from '@/common/utils/response';

@Controller('api/cache')
export class CacheController {
  constructor(private readonly _cacheService: CacheService) {}

  /**
   * 【通用】刷新指定缓存
   * @param cacheKey 缓存KEY 例如 biz:menu:scss
   */
  @Post('refresh')
  async refreshCache(@Body() body: { cacheKey: string }) {
    try {
      const { cacheKey } = body;

      if (!cacheKey) {
        return error(400, 'cacheKey 不能为空');
      }

      // 统一清理缓存
      await this._cacheService.del(cacheKey);
      return success(null, `缓存 ${cacheKey} 已刷新`);
    } catch (e) {
      return error(500, (e as Error).message);
    }
  }
}