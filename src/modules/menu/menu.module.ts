import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { JWT_CONFIG } from '@/common/configs/jwt.config';
import { AppCacheModule } from '@/common/cache/cache.module';

@Module({
  imports: [
    // 👇 必须加这一段，否则 AuthGuard 无法注入 JwtService
    JwtModule.register({
      secret: JWT_CONFIG.secret,
      signOptions: {
        expiresIn: JWT_CONFIG.expiresIn,
      },
    }),
    AppCacheModule,
  ],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}