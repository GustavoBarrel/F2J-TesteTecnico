import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

type AuthenticatedRequest = Request & {
  user?: {
    isGlobalAdmin?: boolean;
  };
};

@Injectable()
export class GlobalAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user?.isGlobalAdmin) {
      throw new ForbiddenException('Acesso permitido apenas para super admin');
    }

    return true;
  }
}
