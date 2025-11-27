import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    // If no auth header, allow access but without user info
    if (!authHeader) {
      request.user = null;
      return true;
    }
    
    // If auth header exists, validate it
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    // If there's an error or no user, return null instead of throwing
    if (err || !user) {
      return null;
    }
    return user;
  }
}