import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/users.schema';
import { FirebaseStorageService } from '../../common/firebase/firebase-storage.service';

describe('UsersService', () => {
    let service: UsersService;
    let userModel: Model<User>;

    const mockUserModel = {
        findOne: jest.fn(),
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        find: jest.fn(),
        new: jest.fn(),
    };

    const mockFirebaseStorageService = {
        uploadFile: jest.fn(),
        deleteFile: jest.fn(),
        getPublicUrl: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: getModelToken(User.name),
                    useValue: mockUserModel,
                },
                {
                    provide: FirebaseStorageService,
                    useValue: mockFirebaseStorageService,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        userModel = module.get<Model<User>>(getModelToken(User.name));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findByPhone', () => {
        it('should find user by phone number', async () => {
            const mockUser = { phone: '+919876543210', name: 'Test User' };
            mockUserModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockUser),
            });

            const result = await service.findByPhone('+919876543210');
            expect(result).toEqual(mockUser);
            expect(mockUserModel.findOne).toHaveBeenCalledWith({ phone: '+919876543210' });
        });

        it('should return null if user not found', async () => {
            mockUserModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.findByPhone('+919876543210');
            expect(result).toBeNull();
        });
    });

    describe('findByFirebaseUserId', () => {
        it('should find user by firebase user ID', async () => {
            const mockUser = { firebaseUserId: 'firebase123', name: 'Test User' };
            mockUserModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockUser),
            });

            const result = await service.findByFirebaseUserId('firebase123');
            expect(result).toEqual(mockUser);
            expect(mockUserModel.findOne).toHaveBeenCalledWith({ firebaseUserId: 'firebase123' });
        });
    });
});
