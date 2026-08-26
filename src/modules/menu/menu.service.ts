// src/modules/menu/menu.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { safePrisma} from '@/common/utils/index';
import { MenuItem } from './types/menu.types';
import { Prisma } from '@prisma/client';
import { CacheService } from '@/common/cache/cache.service';

@Injectable()
export class MenuService {
  constructor(private readonly _cacheService: CacheService) {}

  /**
   * 获取树形菜单
   */
  async getMenuTree(category: string) {
    const cacheKey = `${this._cacheService.PREFIX.BIZ}menu:${category}`;
    const cachedTree = await this._cacheService.get<MenuItem[]>(cacheKey);

    if (cachedTree) {
      return cachedTree;
    }

    const tree = await this.buildMenuTreeFromDb(category);
    await this._cacheService.set(cacheKey, tree, this._cacheService.TTL.BIZ);
    return tree;
  }

  /**
   * 从数据库构建菜单树
   * 一次性查询所有菜单，在内存中构建树形结构，仅占用一次数据库连接
   */
  private async buildMenuTreeFromDb(category: string): Promise<MenuItem[]> {
    const allMenus = await safePrisma.web_menu_list.findMany({
      where: { category },
      orderBy: { sort: 'asc' },
    });

    const menuMap = new Map<string, MenuItem>();
    const rootMenus: MenuItem[] = [];

    for (const menu of allMenus) {
      menuMap.set(menu.menu_id, {
        id: menu.menu_id,
        path: menu.path,
        name: menu.name,
        title: menu.title,
        children: [],
      });
    }

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

    return rootMenus;
  }

  /**
   * 搜索菜单
   */
  async searchMenus(params: {
    category?: string;
    menu_id?: string;
    path?: string;
    name?: string;
    title?: string;
  }) {
    const { category, menu_id, path, name, title } = params;

    const whereCondition: Prisma.web_menu_listWhereInput = {};

    if (category) whereCondition.category = { contains: category };
    else if (menu_id) whereCondition.menu_id = { contains: menu_id };
    else if (path) whereCondition.path = { contains: path };
    else if (name) whereCondition.name = { contains: name };
    else if (title) whereCondition.title = { contains: title };
    else throw new HttpException('请输入搜索条件', HttpStatus.BAD_REQUEST);

    const menuList = await safePrisma.web_menu_list.findMany({
      where: whereCondition,
      orderBy: [{ category: 'asc' }, { menu_id: 'asc' }],
    });

    return menuList.map((item) => ({
      id: item.menu_id,
      path: item.path,
      name: item.name,
      title: item.title,
      category: item.category,
    }));
  }

  /**
   * 批量保存菜单树
   */
  async batchSaveMenuTree(category: string, data: MenuItem[]) {
    // 清空原有菜单
    await safePrisma.web_menu_list.deleteMany({ where: { category } });

    // 递归插入
    for (let i = 0; i < data.length; i++) {
      await this.insertMenu(data[i], category, '0', i + 1);
    }

    // 清空对应缓存
    const cacheKey = `${this._cacheService.PREFIX.BIZ}menu:${category}`;
    await this._cacheService.del(cacheKey);
    console.log(`🗑️ 已清空菜单缓存：${category}`);

    const msg = `[菜单] 分类：${category} 全量覆盖成功`;
    console.log(msg);
    return msg;
  }

  /**
   * 递归插入菜单
   */
  private async insertMenu(
    menu: MenuItem,
    category: string,
    parentId: string,
    sort: number
  ) {
    await safePrisma.web_menu_list.create({
      data: {
        parent_id: parentId,
        name: menu.name,
        path: menu.path,
        title: menu.title,
        sort,
        category,
        menu_id: menu.id,
      },
    });

    if (Array.isArray(menu.children)) {
      for (let j = 0; j < menu.children.length; j++) {
        await this.insertMenu(menu.children[j], category, menu.id, j + 1);
      }
    }
  }
}