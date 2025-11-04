import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for a route
 * @example
 * @Roles('provider')
 * @Roles('seeker', 'admin') // Allow multiple roles
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
