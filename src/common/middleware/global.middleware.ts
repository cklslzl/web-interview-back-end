/*
  全局通用中间件（企业级标准 · 最终干净版）
  1. 请求日志打印
  2. 404 路由不存在处理
  3. 全局统一错误处理（保证前端永远返回 JSON）
*/
// 文件路径：src/common/middleware/global.middleware.ts
import {
  Injectable,
  NestMiddleware,
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { error } from '@/common/utils/response';

// ==============================
// 1. 请求日志中间件（Nest 标准类格式）
// ==============================
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const { method, path, ip } = req;
    const time = new Date().toLocaleString();
    console.log(`[${time}] ${method} ${path} | IP: ${ip}`);
    next();
  }
}

// ==============================
// 2. 404 过滤器（Nest 标准，不拦截正常路由）
// ==============================
@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter {
  catch(_exception: NotFoundException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.json(error(404, '接口不存在，请检查路径'));
  }
}

// ==============================
// 3. 全局统一异常过滤器（Nest 标准）
// ==============================
@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // 处理已知 HTTP 异常
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const msg = exception.message || '服务器异常';
      res.status(status).json(error(status, msg));
      return;
    }

    // 处理未知异常
    const errMsg = exception instanceof Error ? exception.message : '未知错误';
    console.error('【全局异常捕获】', errMsg);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      error(500, `服务器异常：${errMsg}`)
    );
  }
}