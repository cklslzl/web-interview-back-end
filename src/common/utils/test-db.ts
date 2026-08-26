// src/common/utils/test-db.ts
import { safePrisma } from './prisma'

export async function testDbConnection() {
  try {
    const count = await safePrisma.web_menu_list.count()
    console.log('✅ 数据库连接测试成功，数量：', count)
  } catch (err) {
    console.error('❌ 数据库连接失败：', err)
  }
}
