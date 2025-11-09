import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { VerifyFirebaseTokenDto } from '../dto/verify-firebase-token.dto';

// Mock user data
const mockUser = {
    _id: 'user-id-123',
    phone: '+11234567890',
    name: 'Test User',
    email: 'test@example.com',
    role: 'individual',
    isVerified: false,
    kycStatus: 'none',
    save: jest.fn().mockResolvedValue(true),
};

// Mock decoded Firebase token
const mockDecodedToken = {
    uid: 'firebase-uid-abc',
    phone_number: '+11234567890',
    email: 'test@example.com',
};

describe('AuthService', () => {
    let authService: AuthService;
    let usersService: UsersService;
    let firebaseAdminService: FirebaseAdminService;

    // Mock services
    const mockUsersService = {
        findByPhone: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
    };

    const mockFirebaseAdminService = {
        verifyIdToken: jest.fn(),
        createCustomToken: jest.fn(),
        revokeRefreshTokens: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [AuthService, { provide: UsersService, useValue: mockUsersService }, { provide: FirebaseAdminService, useValue: mockFirebaseAdminService }],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        usersService = module.get<UsersService>(UsersService);
        firebaseAdminService = module.get<FirebaseAdminService>(FirebaseAdminService);

        // Reset mocks before each test
        jest.clearAllMocks();
    });

    describe('firebaseLogin', () => {
        const loginDto: VerifyFirebaseTokenDto = {
            idToken: 'valid-firebase-id-token',
            phoneNumber: '+11234567890',
        };

        it('should authenticate and create a new user if they do not exist', async () => {
            // Arrange
            mockFirebaseAdminService.verifyIdToken.mockResolvedValue(mockDecodedToken);
            mockUsersService.findByPhone.mockResolvedValue(null); // User not found
            mockUsersService.create.mockResolvedValue({ ...mockUser, isVerified: true });
            mockFirebaseAdminService.createCustomToken.mockResolvedValue('custom-firebase-token');

            // Act
            const result = await authService.firebaseLogin(loginDto);

            // Assert
            expect(firebaseAdminService.verifyIdToken).toHaveBeenCalledWith(loginDto.idToken);
            expect(usersService.findByPhone).toHaveBeenCalledWith(mockDecodedToken.phone_number);
            expect(usersService.create).toHaveBeenCalledWith({
                phone: mockDecodedToken.phone_number,
                name: 'User',
                email: mockDecodedToken.email,
            });
            expect(firebaseAdminService.createCustomToken).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.customToken).toBe('custom-firebase-token');
            expect(result.user.phone).toBe(mockDecodedToken.phone_number);
        });

        it('should authenticate an existing user and mark them as verified', async () => {
            // Arrange
            const unverifiedUser = { ...mockUser, isVerified: false, save: jest.fn().mockResolvedValue(true) };
            mockFirebaseAdminService.verifyIdToken.mockResolvedValue(mockDecodedToken);
            mockUsersService.findByPhone.mockResolvedValue(unverifiedUser);
            mockFirebaseAdminService.createCustomToken.mockResolvedValue('custom-firebase-token');

            // Act
            const result = await authService.firebaseLogin(loginDto);

            // Assert
            expect(usersService.create).not.toHaveBeenCalled();
            expect(unverifiedUser.save).toHaveBeenCalled(); // Should be saved to update isVerified
            expect(result.success).toBe(true);
            expect(result.user.isVerified).toBe(true);
        });

        it('should throw UnauthorizedException for an invalid ID token', async () => {
            // Arrange
            mockFirebaseAdminService.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

            // Act & Assert
            await expect(authService.firebaseLogin(loginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw BadRequestException if phone number is missing', async () => {
            // Arrange
            const tokenWithoutPhone = { ...mockDecodedToken, phone_number: undefined };
            mockFirebaseAdminService.verifyIdToken.mockResolvedValue(tokenWithoutPhone);

            // Act & Assert
            await expect(authService.firebaseLogin({ ...loginDto, phoneNumber: undefined })).rejects.toThrow(BadRequestException);
        });
    });
});
