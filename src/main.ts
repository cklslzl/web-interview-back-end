// 文件路径：src/main.ts
import { config } from 'dotenv'
import path from 'path'
import { VersioningType } from '@nestjs/common';

// 1. 加载基础环境变量
config({ path: path.resolve(__dirname, '../.env') })
const env = process.env.NODE_ENV || 'development'
config({ path: path.resolve(__dirname, `../.env.${env}`) })
const PORT = process.env.PORT || 3000;
// console.log('src/main.ts 中获取NODE_ENV：', process.env.NODE_ENV)
// console.log('src/main.ts 中获取PORT：', process.env.PORT)
console.log('src/main.ts 中获取SERVER_TITLE：', process.env.SERVER_TITLE)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

// 你的中间件
import { RequestLoggerMiddleware, NotFoundFilter, GlobalErrorFilter } from './common/middleware/global.middleware';

// 数据库测试
import { testDbConnection } from './common/utils/test-db';




async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 全局路由前缀 /api
  app.setGlobalPrefix('api');

  // 版本控制
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
  });

  // 跨域
  app.enableCors();

  // JSON 解析
  app.use(json());

  // 日志中间件
  app.use(new RequestLoggerMiddleware().use);

  // 404 过滤器
  app.useGlobalFilters(new NotFoundFilter());

  // 全局异常过滤器
  app.useGlobalFilters(new GlobalErrorFilter());

  // 数据库测试
  await testDbConnection();

  await app.listen(PORT);
  console.log(`✅ Nest 服务已启动：http://localhost:${PORT} [${env}]`);
}

bootstrap();