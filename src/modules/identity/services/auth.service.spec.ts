import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

// Mock user data
const mockUser = {
    _id: 'user-id-123',
    firebaseUserId: 'firebase-uid-abc',
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
        findByFirebaseUserId: jest.fn(),
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

    describe('register', () => {
        const registerDto: RegisterDto = {
            idToken: 'valid-firebase-id-token',
            name: 'Test User',
            email: 'test@example.com',
        };

        it('should register a new user successfully', async () => {
            // Arrange
            mockFirebaseAdminService.verifyIdToken.mockResolvedValue(mockDecodedToken);
            mockUsersService.findByFirebaseUserId.mockResolvedValue(null); // User not found
            mockUsersService.create.mockResolvedValue({ ...mockUser, isVerified: true });
            mockFirebaseAdminService.createCustomToken.mockResolvedValue('custom-firebase-token');

            // Act
            const result = await authService.register(registerDto);

            // Assert
            expect(firebaseAdminService.verifyIdToken).toHaveBeenCalledWith(registerDto.idToken);
            expect(usersService.findByFirebaseUserId).toHaveBeenCalledWith(mockDecodedToken.uid);
            expect(usersService.create).toHaveBeenCalledWith({
                firebaseUserId: mockDecodedToken.uid,
                phone: mockDecodedToken.phone_number,
                name: registerDto.name,
                email: registerDto.email,
            });
            expect(firebaseAdminService.createCustomToken).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.customToken).toBe('custom-firebase-token');
            expect(result.message).toBe('Registration successful');
        });

        it('should throw BadRequestException if user already registered', async () => {
            // Arrange
            mockFirebaseAdminService.verifyIdToken.mockResolvedValue(mockDecodedToken);
            mockUsersService.findByFirebaseUserId.mockResolvedValue(mockUser); // User exists

            // Act & Assert
            await expect(authService.register(registerDto)).rejects.toThrow(BadRequestException);
            await expect(authService.register(registerDto)).rejects.toThrow('User already registered. Please login instead.');
        });

        it('should throw UnauthorizedException for invalid token', async () => {
            // Arrange
            mockFirebaseAdminService.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

            // Act & Assert
            await expect(authService.register(registerDto)).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('login', () => {
        const loginDto: LoginDto = {
            idToken: 'valid-firebase-id-token',
        };

        it('should login an existing user successfully', async () => {
            // Arrange
            const existingUser = { ...mockUser, isVerified: true, save: jest.fn().mockResolvedValue(true) };
            mockFirebaseAdminService.verifyIdToken.mockResolvedValue(mockDecodedToken);
            mockUsersService.findByFirebaseUserId.mockResolvedValue(existingUser);
            mockFirebaseAdminService.createCustomToken.mockResolvedValue('custom-firebase-token');

            // Act
            const result = await authService.login(loginDto);

            // Assert
            expect(firebaseAdminService.verifyIdToken).toHaveBeenCalledWith(loginDto.idToken);
            expect(usersService.findByFirebaseUserId).toHaveBeenCalledWith(mockDecodedToken.uid);
            expect(firebaseAdminService.createCustomToken).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.customToken).toBe('custom-firebase-token');
            expect(result.message).toBe('Login successful');
        });

        it('should mark unverified user as verified on login', async () => {
            // Arrange
            const unverifiedUser = { ...mockUser, isVerified: false, save: jest.fn().mockResolvedValue(true) };
            mockFirebaseAdminService.verifyIdToken.mockResolvedValue(mockDecodedToken);
            mockUsersService.findByFirebaseUserId.mockResolvedValue(unverifiedUser);
            mockFirebaseAdminService.createCustomToken.mockResolvedValue('custom-firebase-token');

            // Act
            const result = await authService.login(loginDto);

            // Assert
            expect(unverifiedUser.save).toHaveBeenCalled();
            expect(unverifiedUser.isVerified).toBe(true);
            expect(result.success).toBe(true);
        });

        it('should throw NotFoundException if user not registered', async () => {
            // Arrange
            mockFirebaseAdminService.verifyIdToken.mockResolvedValue(mockDecodedToken);
            mockUsersService.findByFirebaseUserId.mockResolvedValue(null); // User not found

            // Act & Assert
            await expect(authService.login(loginDto)).rejects.toThrow(NotFoundException);
            await expect(authService.login(loginDto)).rejects.toThrow('User not registered. Please register first.');
        });

        it('should throw UnauthorizedException for invalid token', async () => {
            // Arrange
            mockFirebaseAdminService.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

            // Act & Assert
            await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });
    });
});
