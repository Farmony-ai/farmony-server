import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract current user from request
 * User is attached to request by FirebaseAuthGuard
 */
export const CurrentUser = createParamDecorator(
    (data: string | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;
                if (data && user) {
                     return user[data];
                 }
        
        return user;
    },
);
