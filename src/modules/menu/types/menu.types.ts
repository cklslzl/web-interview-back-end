// 文件路径：src/modules/menu/types/menu.types.ts
import type { web_menu_list } from '@prisma/client'

// 直接用 Prisma 生成的数据库类型
export type MenuRow = web_menu_list

// 前端菜单结构（不变）
export interface MenuItem {
  id: string
  path: string
  name: string
  title: string
  category?: string
  children?: MenuItem[]
}