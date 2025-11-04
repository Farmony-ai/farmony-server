import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';
import { VerifyFirebaseTokenDto } from '../dto/verify-firebase-token.dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(private readonly usersService: UsersService, private readonly firebaseAdmin: FirebaseAdminService) {}

    /**
     * Main authentication flow:
     * 1. Verify Firebase ID token (proves user completed OTP)
     * 2. Get or create user in MongoDB
     * 3. Generate custom Firebase token with RBAC claims
     * 4. Return custom token + user data to client
     */
    async firebaseLogin(dto: VerifyFirebaseTokenDto) {
        try {
            // Step 1: Verify Firebase ID token
            const decodedToken = await this.firebaseAdmin.verifyIdToken(dto.idToken);

            const phoneNumber = decodedToken.phone_number || dto.phoneNumber;
            if (!phoneNumber) {
                throw new BadRequestException('Phone number is required');
            }

            this.logger.log(`Firebase token verified for phone: ${phoneNumber}`);

            // Step 2: Find or create user in MongoDB
            let user = await this.usersService.findByPhone(phoneNumber);

            if (!user) {
                // New user - create in MongoDB
                this.logger.log(`Creating new user for phone: ${phoneNumber}`);
                user = await this.usersService.create({
                    phone: phoneNumber,
                    name: dto.name || 'User',
                    email: decodedToken.email,
                });
            } else {
                // Existing user - mark as verified if not already
                if (!user.isVerified) {
                    user.isVerified = true;
                    await user.save();
                    this.logger.log(`User ${user._id} marked as verified`);
                }
            }

            // Step 3: Determine RBAC roles
            const rbacClaims = this.buildRbacClaims(user);

            // Step 4: Generate custom Firebase token with RBAC claims
            const customToken = await this.firebaseAdmin.createCustomToken(
                user._id.toString(), // Use MongoDB ID as Firebase UID
                rbacClaims
            );

            this.logger.log(`Custom token generated for user ${user._id} with role: ${user.role}`);

            // Step 5: Return response
            return {
                success: true,
                customToken,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    isVerified: user.isVerified,
                    kycStatus: user.kycStatus,
                    ...rbacClaims, // Include claims in response
                },
                message: 'Authentication successful',
            };
        } catch (error) {
            this.logger.error('Firebase login failed:', error);
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException('Authentication failed');
        }
    }

    /**
     * Build RBAC claims based on user role and status
     */
    private buildRbacClaims(user: any) {
        const role = user.role || 'individual';

        return {
            role,
            isProvider: role === 'individual' || role === 'SHG' || role === 'FPO',
            isSeeker: true, // Everyone can be a seeker
            isAdmin: role === 'admin',
            email: user.email || null,
            phone: user.phone,
            isVerified: user.isVerified || false,
            kycStatus: user.kycStatus || 'none',
        };
    }

    /**
     * Update user role (admin only)
     * This regenerates the custom token with new claims
     */
    async updateUserRole(userId: string, newRole: string) {
        const user = await this.usersService.findById(userId);

        // Update role in MongoDB
        user.role = newRole;
        await user.save();

        // Build new RBAC claims
        const rbacClaims = this.buildRbacClaims(user);

        // Generate new custom token
        const customToken = await this.firebaseAdmin.createCustomToken(userId, rbacClaims);

        this.logger.log(`Role updated for user ${userId}: ${newRole}`);

        return {
            success: true,
            customToken,
            user: {
                id: user._id,
                role: user.role,
                ...rbacClaims,
            },
            message: 'Role updated successfully. Please sign in again with the new token.',
        };
    }

    /**
     * Logout user (revoke refresh tokens)
     */
    async logout(uid: string) {
        try {
            await this.firebaseAdmin.revokeRefreshTokens(uid);
            this.logger.log(`User ${uid} logged out successfully`);
            return {
                success: true,
                message: 'Logged out successfully',
            };
        } catch (error) {
            this.logger.error(`Logout failed for user ${uid}:`, error);
            throw new BadRequestException('Logout failed');
        }
    }

    /**
     * Verify current token and return user claims
     */
    async verifyToken(idToken: string) {
        try {
            const decodedToken = await this.firebaseAdmin.verifyIdToken(idToken);

            return {
                valid: true,
                uid: decodedToken.uid,
                phone: decodedToken.phone_number,
                email: decodedToken.email,
                role: decodedToken.role,
                isProvider: decodedToken.isProvider,
                isSeeker: decodedToken.isSeeker,
                isAdmin: decodedToken.isAdmin,
                isVerified: decodedToken.isVerified,
                kycStatus: decodedToken.kycStatus,
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
            };
        }
    }
}
