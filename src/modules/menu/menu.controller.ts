import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common'
import { MenuService } from './menu.service'
import { success, error } from '@/common/utils/response'
import { MenuItem } from './types/menu.types'
import { AuthGuard } from '@/common/guards/auth.guard' // 导入守卫

@Controller('menus')
export class MenuController {
  constructor(private readonly _menuService: MenuService) {}
  /**
   * 获取列表接口、搜索接口（需要登录才能访问）
   * 全流程校验顺序：
   * 1. AuthGuard 先执行：
   *    a. 从请求头获取 token
   *    b. 先查 Redis 黑名单：存在 → 直接 401 拦截
   *    c. 不在黑名单 → 校验 JWT 签名、过期时间
   *    d. 校验通过 → 将用户信息存入 req.user
   * 2. 守卫校验通过后，才进入当前接口逻辑
   * 3. 校验 category 参数是否存在
   * 4. 查询并返回菜单树形结构
   */

  // 1. 获取树形菜单 → 添加登录守卫（user 可访问）
  @Get('list')
  @UseGuards(AuthGuard)
  async getMenuList(@Query('category') category: string) {
    try {
      if (!category) throw new HttpException('category 不能为空', HttpStatus.BAD_REQUEST)
      const tree = await this._menuService.getMenuTree(category)
      return success(tree)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '服务器错误'
      return error(HttpStatus.INTERNAL_SERVER_ERROR, msg)
    }
  }

  // 2. 搜索菜单 → 添加登录守卫（user 可访问）
  @Get('search')
  @UseGuards(AuthGuard)
  async searchMenuList(
    @Query('category') category?: string,
    @Query('menu_id') menu_id?: string,
    @Query('path') path?: string,
    @Query('name') name?: string,
    @Query('title') title?: string,
  ) {
    try {
      const list = await this._menuService.searchMenus({ category, menu_id, path, name, title })
      return success(list)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '服务器错误'
      return error(HttpStatus.INTERNAL_SERVER_ERROR, msg)
    }
  }

  // 3. 批量保存树形菜单 → 不加守卫（脚本可用）
  @Post('batch-save')
  async batchSaveMenuList(@Body() body: { category: string; data: MenuItem[] }) {
    try {
      const { category, data } = body
      if (!category) throw new HttpException('category 不能为空', HttpStatus.BAD_REQUEST)
      if (!Array.isArray(data)) throw new HttpException('data 必须是数组', HttpStatus.BAD_REQUEST)

      const msg = await this._menuService.batchSaveMenuTree(category, data)
      return success(null, msg)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '服务器错误'
      return error(HttpStatus.INTERNAL_SERVER_ERROR, msg)
    }
  }
}
