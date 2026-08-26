import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;

    const requiredRoles = Reflect.getMetadata('roles', context.getHandler());
    if (!requiredRoles) return true;

    return requiredRoles.includes(user.role);
  }
}