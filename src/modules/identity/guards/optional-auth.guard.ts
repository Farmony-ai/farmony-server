import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';

/**
 * OptionalAuthGuard allows both authenticated and unauthenticated requests
 *
 * If a valid token is provided:
 *   - Verifies the token and attaches user to request.user
 *   - Allows the request to proceed
 *
 * If no token or invalid token:
 *   - Sets request.user to null
 *   - Allows the request to proceed (no exception thrown)
 *
 * This is useful for endpoints that can work with or without authentication,
 * providing different functionality based on auth status
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
    private readonly logger = new Logger(OptionalAuthGuard.name);

    constructor(private readonly firebaseAdmin: FirebaseAdminService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        // No authorization header - allow request with null user
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            request.user = null;
            return true;
        }

        const token = authHeader.split(' ')[1];

        try {
            // Try to verify Firebase ID token
            const decodedToken = await this.firebaseAdmin.verifyIdToken(token);

            // Attach decoded token to request
            request.user = {
                uid: decodedToken.uid,
                phone: decodedToken.phone_number,
                email: decodedToken.email,
                // Extract custom claims
                role: decodedToken.role || null,
                isProvider: decodedToken.isProvider || false,
                isSeeker: decodedToken.isSeeker || false,
                isAdmin: decodedToken.isAdmin || false,
                isVerified: decodedToken.isVerified || false,
                kycStatus: decodedToken.kycStatus || 'none',
                // Include full token for debugging
                firebaseToken: decodedToken,
            };

            this.logger.debug(`Authenticated request from user ${decodedToken.uid}`);
            return true;
        } catch (error) {
            // Token verification failed - allow request with null user
            this.logger.debug('Token verification failed, allowing unauthenticated access');
            request.user = null;
            return true;
        }
    }
}
