import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
    private readonly logger = new Logger(FirebaseAuthGuard.name);

    constructor(private readonly firebaseAdmin: FirebaseAdminService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('No token provided');
        }

        const token = authHeader.split(' ')[1];

        try {
            // Verify Firebase ID token
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

            return true;
        } catch (error) {
            this.logger.error('Token verification failed:', error);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
