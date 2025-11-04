import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import 'firebase-admin/storage';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseAdminService.name);
    private firebaseApp: admin.app.App;
    private storageBucketName?: string;
    private storageBucket?: admin.storage.Bucket;

    constructor(private configService: ConfigService) {}

    onModuleInit() {
        this.initializeFirebase();
    }

    private initializeFirebase() {
        try {
            // Option 1: Use service account JSON file
            const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
            this.storageBucketName = this.configService.get<string>('FIREBASE_STORAGE_BUCKET') || undefined;

            if (!this.storageBucketName) {
                this.logger.warn('FIREBASE_STORAGE_BUCKET is not configured. Firebase Storage operations will be disabled.');
            }

            if (serviceAccountPath) {
                const serviceAccount = require(serviceAccountPath);
                const appOptions: admin.AppOptions = {
                    credential: admin.credential.cert(serviceAccount),
                };
                if (this.storageBucketName) {
                    appOptions.storageBucket = this.storageBucketName;
                }
                this.firebaseApp = admin.initializeApp(appOptions);
                this.logger.log('✅ Firebase Admin initialized with service account file');
            } else {
                // Option 2: Use environment variables
                const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
                const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'); // Handle escaped newlines
                const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

                if (!projectId || !privateKey || !clientEmail) {
                    throw new Error('Missing Firebase credentials in environment variables');
                }

                const appOptions: admin.AppOptions = {
                    credential: admin.credential.cert({
                        projectId,
                        privateKey,
                        clientEmail,
                    }),
                };
                if (this.storageBucketName) {
                    appOptions.storageBucket = this.storageBucketName;
                }
                this.firebaseApp = admin.initializeApp(appOptions);
                this.logger.log('✅ Firebase Admin initialized with environment variables');
            }
        } catch (error) {
            this.logger.error('❌ Failed to initialize Firebase Admin:', error);
            throw error;
        }
    }

    private getBucket(): admin.storage.Bucket {
        if (!this.firebaseApp) {
            throw new Error('Firebase app is not initialized');
        }
        if (!this.storageBucketName) {
            throw new Error('FIREBASE_STORAGE_BUCKET is not configured');
        }
        if (!this.storageBucket) {
            this.storageBucket = this.firebaseApp.storage().bucket(this.storageBucketName);
        }
        return this.storageBucket;
    }

    /**
     * Verify Firebase ID token from client
     */
    async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            return decodedToken;
        } catch (error) {
            this.logger.error('Failed to verify Firebase token:', error);
            throw new Error('Invalid Firebase token');
        }
    }

    /**
     * Create custom token with RBAC claims
     */
    async createCustomToken(
        uid: string,
        additionalClaims?: {
            role?: string;
            isProvider?: boolean;
            isSeeker?: boolean;
            isAdmin?: boolean;
            email?: string;
            phone?: string;
            isVerified?: boolean;
            kycStatus?: string;
            [key: string]: any;
        }
    ): Promise<string> {
        try {
            const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
            this.logger.log(`Custom token created for user ${uid}`);
            return customToken;
        } catch (error) {
            this.logger.error('Failed to create custom token:', error);
            throw new Error('Failed to create custom token');
        }
    }

    /**
     * Set custom claims on existing Firebase user
     */
    async setCustomClaims(uid: string, claims: object): Promise<void> {
        try {
            await admin.auth().setCustomUserClaims(uid, claims);
            this.logger.log(`Custom claims set for user ${uid}`);
        } catch (error) {
            this.logger.error('Failed to set custom claims:', error);
            throw new Error('Failed to set custom claims');
        }
    }

    /**
     * Get user by phone number
     */
    async getUserByPhoneNumber(phoneNumber: string): Promise<admin.auth.UserRecord | null> {
        try {
            const user = await admin.auth().getUserByPhoneNumber(phoneNumber);
            return user;
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                return null;
            }
            throw error;
        }
    }

    /**
     * Get user by UID
     */
    async getUserByUid(uid: string): Promise<admin.auth.UserRecord> {
        try {
            return await admin.auth().getUser(uid);
        } catch (error) {
            this.logger.error(`Failed to get user ${uid}:`, error);
            throw new Error('User not found');
        }
    }

    /**
     * Create Firebase user (if needed)
     */
    async createUser(params: { uid?: string; phoneNumber?: string; email?: string; displayName?: string }): Promise<admin.auth.UserRecord> {
        try {
            return await admin.auth().createUser(params);
        } catch (error) {
            this.logger.error('Failed to create Firebase user:', error);
            throw error;
        }
    }

    /**
     * Delete Firebase user
     */
    async deleteUser(uid: string): Promise<void> {
        try {
            await admin.auth().deleteUser(uid);
            this.logger.log(`Firebase user ${uid} deleted`);
        } catch (error) {
            this.logger.error(`Failed to delete user ${uid}:`, error);
            throw error;
        }
    }

    /**
     * Revoke refresh tokens (force logout)
     */
    async revokeRefreshTokens(uid: string): Promise<void> {
        try {
            await admin.auth().revokeRefreshTokens(uid);
            this.logger.log(`Refresh tokens revoked for user ${uid}`);
        } catch (error) {
            this.logger.error(`Failed to revoke tokens for ${uid}:`, error);
            throw error;
        }
    }

    /**
     * Upload a file buffer to Firebase Storage
     */
    async uploadFileToStorage(params: { buffer: Buffer; destination: string; contentType?: string; metadata?: Record<string, string> }): Promise<void> {
        try {
            const bucket = this.getBucket();
            const file = bucket.file(params.destination);
            await file.save(params.buffer, {
                contentType: params.contentType,
                metadata: params.metadata ? { metadata: params.metadata } : undefined,
            });
            this.logger.debug(`Uploaded file to Firebase Storage: ${params.destination}`);
        } catch (error) {
            this.logger.error(`Failed to upload file to Firebase Storage (${params.destination}):`, error);
            throw new Error('Failed to upload file to Firebase Storage');
        }
    }

    /**
     * Delete a file from Firebase Storage
     */
    async deleteFileFromStorage(path: string): Promise<void> {
        try {
            const bucket = this.getBucket();
            await bucket.file(path).delete({ ignoreNotFound: true });
            this.logger.debug(`Deleted file from Firebase Storage: ${path}`);
        } catch (error) {
            this.logger.error(`Failed to delete file ${path} from Firebase Storage:`, error);
            throw new Error('Failed to delete file from Firebase Storage');
        }
    }

    /**
     * Get public URL for a file stored in Firebase Storage
     */
    getStoragePublicUrl(path?: string | null): string | null {
        if (!path) {
            return null;
        }
        const bucketName = this.storageBucketName || this.getBucket().name;
        const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
        return `https://storage.googleapis.com/${bucketName}/${encodedPath}`;
    }

    /**
     * Get Firebase Auth instance (for advanced operations)
     */
    getAuth(): admin.auth.Auth {
        return admin.auth();
    }
}
