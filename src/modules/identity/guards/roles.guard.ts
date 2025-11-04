import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    private readonly logger = new Logger(RolesGuard.name);

    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        // Get required roles from decorator
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);

        // If no roles specified, allow access
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            this.logger.warn('No user found in request. FirebaseAuthGuard should run before RolesGuard.');
            throw new ForbiddenException('User not authenticated');
        }

        // Check if user has required role
        const hasRole = requiredRoles.some((role) => {
            switch (role) {
                case 'admin':
                    return user.isAdmin === true;
                case 'provider':
                    return user.isProvider === true;
                case 'seeker':
                    return user.isSeeker === true;
                default:
                    return user.role === role;
            }
        });

        if (!hasRole) {
            this.logger.warn(`User ${user.uid} with role '${user.role}' attempted to access route requiring: ${requiredRoles.join(', ')}`);
            throw new ForbiddenException(`Access denied. Required role(s): ${requiredRoles.join(' or ')}`);
        }

        return true;
    }
}
