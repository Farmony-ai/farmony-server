import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Validates that the :id or :userId param matches the authenticated user's userId,
 * OR the user is an admin. Must be used after FirebaseAuthGuard.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // Admins can access any resource
        if (user.isAdmin) {
            return true;
        }

        // Check route params for user ID
        const paramId = request.params.id || request.params.userId;

        if (!paramId) {
            // No ID param to check - allow (guard might be misapplied)
            return true;
        }

        if (paramId !== user.userId) {
            throw new ForbiddenException('You can only access your own resources');
        }

        return true;
    }
}
