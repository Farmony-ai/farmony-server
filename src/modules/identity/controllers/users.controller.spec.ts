import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from '../services/users.service';
import { AddressService } from '../services/address.service';
import { FcmTokenService } from '../services/fcm-token.service';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { OwnershipGuard } from '../guards/ownership.guard';
import { RolesGuard } from '../guards/roles.guard';

describe('UsersController', () => {
    let controller: UsersController;

    const mockUsersService = {
        findById: jest.fn(),
        findByIdWithProfileUrl: jest.fn(),
        findByPhone: jest.fn(),
        updatePreferences: jest.fn(),
        updateUser: jest.fn(),
        verifyUser: jest.fn(),
        unverifyUser: jest.fn(),
        uploadProfilePicture: jest.fn(),
        deleteProfilePicture: jest.fn(),
    };

    const mockAddressService = {
        getUserAddresses: jest.fn(),
        getAddressById: jest.fn(),
        createAddress: jest.fn(),
        updateAddress: jest.fn(),
        deleteAddress: jest.fn(),
        setDefaultAddress: jest.fn(),
    };

    const mockFcmTokenService = {
        registerToken: jest.fn(),
        removeToken: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                { provide: UsersService, useValue: mockUsersService },
                { provide: AddressService, useValue: mockAddressService },
                { provide: FcmTokenService, useValue: mockFcmTokenService },
            ],
        })
            .overrideGuard(FirebaseAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(OwnershipGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<UsersController>(UsersController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('checkPhoneExists', () => {
        it('should return exists: true when phone is registered', async () => {
            mockUsersService.findByPhone.mockResolvedValue({ phone: '+919876543210' });
            const result = await controller.checkPhoneExists('+919876543210');
            expect(result.exists).toBe(true);
        });

        it('should return exists: false when phone is not registered', async () => {
            mockUsersService.findByPhone.mockResolvedValue(null);
            const result = await controller.checkPhoneExists('+919876543210');
            expect(result.exists).toBe(false);
        });
    });

    describe('getCurrentUser', () => {
        it('should return current user profile', async () => {
            const mockUser = {
                _id: 'user123',
                name: 'Test User',
                email: 'test@example.com',
                phone: '+919876543210',
                role: 'individual',
                isVerified: true,
                kycStatus: 'none',
                preferences: {},
                addresses: [],
            };
            mockUsersService.findByIdWithProfileUrl.mockResolvedValue(mockUser);

            const result = await controller.getCurrentUser({ userId: 'user123' });
            expect(result.id).toBe('user123');
            expect(result.name).toBe('Test User');
        });
    });

    describe('registerFcmToken', () => {
        it('should register FCM token', async () => {
            mockFcmTokenService.registerToken.mockResolvedValue(undefined);
            const result = await controller.registerFcmToken(
                { token: 'fcm-token-123' },
                { userId: 'user123' },
            );
            expect(result.message).toBe('FCM token registered successfully');
            expect(mockFcmTokenService.registerToken).toHaveBeenCalledWith('user123', 'fcm-token-123');
        });
    });
});
