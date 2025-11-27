import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { FirebaseLoginDto } from '../dto/firebase-login.dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(private readonly usersService: UsersService, private readonly firebaseAdmin: FirebaseAdminService) { }

    /**
     * Register a new user:
     * 1. Verify Firebase ID token
     * 2. Check user doesn't already exist
     * 3. Create user in MongoDB
     * 4. Return custom token with RBAC claims
     */
    async register(dto: RegisterDto) {
        try {
            const decodedToken = await this.firebaseAdmin.verifyIdToken(dto.idToken);

            const firebaseUserId = decodedToken.uid;
            const phone = decodedToken.phone_number;
            const email = dto.email || decodedToken.email;

            this.logger.log(`Registration attempt for Firebase UID: ${firebaseUserId}`);

            // Check if user already exists
            const existingUser = await this.usersService.findByFirebaseUserId(firebaseUserId);
            if (existingUser) {
                throw new BadRequestException('User already registered. Please login instead.');
            }

            // Create new user
            const user = await this.usersService.create({
                firebaseUserId,
                phone,
                name: dto.name,
                email,
            });

            this.logger.log(`New user created: ${user._id}`);

            // Set custom claims on the existing Firebase user
            const rbacClaims = this.buildRbacClaims(user);
            await this.firebaseAdmin.setCustomClaims(firebaseUserId, rbacClaims);

            return {
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    isVerified: user.isVerified,
                    kycStatus: user.kycStatus,
                    ...rbacClaims,
                },
                message: 'Registration successful',
            };
        } catch (error) {
            this.logger.error('Registration failed:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new UnauthorizedException('Registration failed: Invalid token');
        }
    }

    /**
     * Login existing user:
     * 1. Verify Firebase ID token
     * 2. Find user by firebaseUserId
     * 3. Return custom token with RBAC claims
     */
    async login(dto: LoginDto) {
        try {
            const decodedToken = await this.firebaseAdmin.verifyIdToken(dto.idToken);

            const firebaseUserId = decodedToken.uid;

            this.logger.log(`Login attempt for Firebase UID: ${firebaseUserId}`);

            // Find existing user
            const user = await this.usersService.findByFirebaseUserId(firebaseUserId);
            if (!user) {
                throw new NotFoundException('User not registered. Please register first.');
            }

            // Mark as verified if not already
            if (!user.isVerified) {
                user.isVerified = true;
                await user.save();
                this.logger.log(`User ${user._id} marked as verified`);
            }

            // Set custom claims on the existing Firebase user
            const rbacClaims = this.buildRbacClaims(user);
            await this.firebaseAdmin.setCustomClaims(firebaseUserId, rbacClaims);

            this.logger.log(`Login successful for user ${user._id}`);

            return {
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    isVerified: user.isVerified,
                    kycStatus: user.kycStatus,
                    ...rbacClaims,
                },
                message: 'Login successful',
            };
        } catch (error) {
            this.logger.error('Login failed:', error);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new UnauthorizedException('Login failed: Invalid token');
        }
    }

    /**
     * Firebase OTP Login (unified register/login):
     * 1. Verify Firebase ID token
     * 2. Check if user exists by firebaseUserId OR phone
     * 3. If exists → login (and update firebaseUserId if changed)
     * 4. If not exists → register (requires name)
     */
    async firebaseLogin(dto: FirebaseLoginDto) {
        try {
            const decodedToken = await this.firebaseAdmin.verifyIdToken(dto.idToken);

            const firebaseUserId = decodedToken.uid;
            const phone = dto.phoneNumber || decodedToken.phone_number;
            const email = dto.email || decodedToken.email;

            this.logger.log(`Firebase login attempt for Firebase UID: ${firebaseUserId}, phone: ${phone}`);

            // Check if user exists by firebaseUserId first
            let user = await this.usersService.findByFirebaseUserId(firebaseUserId);

            // If not found by firebaseUserId, check by phone (handles Firebase account recreation)
            if (!user && phone) {
                user = await this.usersService.findByPhone(phone);

                if (user) {
                    // User exists with same phone but different firebaseUserId
                    // This happens when user deletes Firebase account and creates new one
                    this.logger.log(`Found user by phone, updating firebaseUserId from ${user.firebaseUserId} to ${firebaseUserId}`);
                    user.firebaseUserId = firebaseUserId;
                    await user.save();
                }
            }

            if (user) {
                // Existing user - login
                this.logger.log(`Existing user found, logging in: ${user._id}`);

                // Mark as verified if not already
                if (!user.isVerified) {
                    user.isVerified = true;
                    await user.save();
                    this.logger.log(`User ${user._id} marked as verified`);
                }
            } else {
                // New user - register
                this.logger.log(`New user, registering...`);

                if (!dto.name) {
                    throw new BadRequestException('Name is required for first-time registration');
                }

                user = await this.usersService.create({
                    firebaseUserId,
                    phone,
                    name: dto.name,
                    email,
                });

                this.logger.log(`New user created: ${user._id}`);
            }

            // Set custom claims on the existing Firebase user
            const rbacClaims = this.buildRbacClaims(user);
            await this.firebaseAdmin.setCustomClaims(firebaseUserId, rbacClaims);

            this.logger.log(`Firebase login successful for user ${user._id}`);

            return {
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    isVerified: user.isVerified,
                    kycStatus: user.kycStatus,
                    ...rbacClaims,
                },
                message: 'Login successful',
            };
        } catch (error) {
            this.logger.error('Firebase login failed:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new UnauthorizedException('Firebase login failed: Invalid token');
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

        // Set custom claims
        const rbacClaims = this.buildRbacClaims(user);
        await this.firebaseAdmin.setCustomClaims(user.firebaseUserId, rbacClaims);

        this.logger.log(`Role updated for user ${userId}: ${newRole}`);

        return {
            success: true,
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
