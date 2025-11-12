import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract current user from request
 * User is attached to request by FirebaseAuthGuard
 */
export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);
