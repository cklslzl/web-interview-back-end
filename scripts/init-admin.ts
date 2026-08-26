import { safePrisma } from '@/common/utils/index';
import * as crypto from 'crypto';
import adminJson from './import/admin.json';

// 密码加密
const encryptPassword = (password: string) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

async function seedAdmin() {
  console.log('✅ 当前环境：', process.env.NODE_ENV);
  console.log('🔨 开始初始化超级管理员...');
  const adminData = {
    username: adminJson.username,
    password: encryptPassword(adminJson.password),
    phone: adminJson.phone,
    email: adminJson.email,
    role: 'admin',
    status: 1,
  };

  // 检查是否已存在
  const existAdmin = await safePrisma.users.findUnique({
    where: { username: adminData.username },
  });

  if (existAdmin) {
    console.log('⚠️ 管理员已存在，跳过创建');
    return;
  }

  // 创建
  await safePrisma.users.create({ data: adminData });
  console.log('✅ 超级管理员admin创建成功！');
}

// 执行 + 安全关闭数据库连接
seedAdmin()
  .catch((err) => {
    console.error('❌ 初始化失败：', err);
    process.exit(1);
  })
  .finally(async () => {
    await safePrisma.$disconnect();
  });