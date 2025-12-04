import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';
import { User, UserDocument } from '../schemas/users.schema';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
    private readonly logger = new Logger(FirebaseAuthGuard.name);

    constructor(
        private readonly firebaseAdmin: FirebaseAdminService,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('No token provided');
        }

        const token = authHeader.split(' ')[1];

        try {
            // Verify Firebase ID token
            const decodedToken = await this.firebaseAdmin.verifyIdToken(token);

            // Hydrate user from MongoDB
            const user = await this.userModel.findOne({ firebaseUserId: decodedToken.uid }).exec();
            if (!user) {
                throw new UnauthorizedException('User not found in database');
            }

            // Attach user info to request
            request.user = {
                userId: user._id.toString(),
                uid: decodedToken.uid,
                phone: user.phone || decodedToken.phone_number,
                email: user.email || decodedToken.email,
                role: user.role,
                isProvider: user.role === 'individual' || user.role === 'SHG' || user.role === 'FPO',
                isSeeker: true,
                isAdmin: user.role === 'admin',
                isVerified: user.isVerified,
                kycStatus: user.kycStatus || 'none',
            };

            return true;
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            this.logger.error('Token verification failed:', error);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
