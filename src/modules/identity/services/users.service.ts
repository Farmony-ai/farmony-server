import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/users.schema';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { FirebaseStorageService } from '../../common/firebase/firebase-storage.service';

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>, private readonly storageService: FirebaseStorageService) {}

    async create(createDto: CreateUserDto): Promise<UserDocument> {
        // Check if email already exists, only if provided
        if (createDto.email) {
            const emailExists = await this.userModel.findOne({ email: createDto.email });
            if (emailExists) throw new BadRequestException('Email already in use');
        }

        // Check if phone already exists
        const phoneExists = await this.userModel.findOne({ phone: createDto.phone });
        if (phoneExists) throw new BadRequestException('Phone number already in use');

        const user = new this.userModel({
            ...createDto,
            preferences: {
                defaultLandingPage: 'provider',
                defaultProviderTab: 'active',
                notificationsEnabled: true,
            },
        });
        return user.save();
    }

    async findByEmail(email: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ email }).exec();
    }

    async findByPhone(phone: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ phone }).exec();
    }

    async findById(id: string): Promise<UserDocument> {
        const user = await this.userModel.findById(id).exec();
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async findByIdWithProfileUrl(id: string): Promise<UserDocument & { profilePictureUrl?: string }> {
        const user = await this.findById(id);
        const userObj = user.toObject();
        return {
            ...userObj,
            profilePictureUrl: this.storageService.getPublicUrl(user.profilePicture) || undefined,
        };
    }

    async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<User> {
        const user = await this.findById(userId);

        if (!user.preferences) {
            user.preferences = {} as any;
        }

        // Update preferences
        if (dto.defaultLandingPage !== undefined) {
            user.preferences.defaultLandingPage = dto.defaultLandingPage;
        }
        if (dto.defaultProviderTab !== undefined) {
            user.preferences.defaultProviderTab = dto.defaultProviderTab;
        }
        if (dto.preferredLanguage !== undefined) {
            user.preferences.preferredLanguage = dto.preferredLanguage;
        }
        if (dto.notificationsEnabled !== undefined) {
            user.preferences.notificationsEnabled = dto.notificationsEnabled;
        }

        return user.save();
    }

    async setDefaultAddress(userId: string, addressId: string): Promise<User> {
        const user = await this.findById(userId);
        if (!Types.ObjectId.isValid(addressId)) {
            throw new BadRequestException('Invalid address ID');
        }
        user.defaultAddressId = new Types.ObjectId(addressId);
        return user.save();
    }

    async getUserWithAddress(userId: string): Promise<any> {
        return this.userModel.findById(userId).populate('defaultAddressId').exec();
    }

    // 🔄 Update user fields (including isVerified)
    async updateUser(id: string, updateDto: UpdateUserDto): Promise<UserDocument> {
        const user = await this.userModel.findByIdAndUpdate(id, updateDto, { new: true, runValidators: true }).exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    // ✅ Quick method to verify user (set isVerified to true)
    async verifyUser(id: string): Promise<UserDocument> {
        return this.updateUser(id, { isVerified: true });
    }

    // ❌ Quick method to unverify user (set isVerified to false)
    async unverifyUser(id: string): Promise<UserDocument> {
        return this.updateUser(id, { isVerified: false });
    }

    // 🔍 Debug method to check all users with phone numbers
    async getAllUsersWithPhones(): Promise<UserDocument[]> {
        return this.userModel.find({}, 'email phone name').exec();
    }

    // 📸 Profile Picture Methods
    async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<{ user: UserDocument; key: string; url: string | null }> {
        const user = await this.findById(userId);

        if (!file || !file.buffer) {
            throw new BadRequestException('Uploaded file is empty');
        }

        const previousKey = user.profilePicture;
        const key = await this.storageService.uploadFile(file, `profile-pictures/${userId}`);

        user.profilePicture = key;
        await user.save();

        if (previousKey && previousKey !== key) {
            await this.storageService.deleteFile(previousKey);
        }

        return {
            user,
            key,
            url: this.storageService.getPublicUrl(key),
        };
    }

    async deleteProfilePicture(userId: string): Promise<UserDocument> {
        const user = await this.findById(userId);

        if (user.profilePicture) {
            await this.storageService.deleteFile(user.profilePicture);
        }

        // Update user document to remove profile picture reference
        user.profilePicture = undefined;
        return user.save();
    }

    /**
     * Register FCM device token for push notifications
     * @param userId - User ID
     * @param token - FCM device token
     * @returns Updated user document
     */
    async registerFcmToken(userId: string, token: string): Promise<UserDocument> {
        if (!token) {
            throw new BadRequestException('FCM token is required');
        }

        // Add token to user's fcmTokens array if not already present
        const user = await this.userModel.findByIdAndUpdate(
            userId,
            { $addToSet: { fcmTokens: token } },
            { new: true }
        ).exec();

        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }

        return user;
    }

    /**
     * Remove FCM device token (e.g., on logout or token expiry)
     * @param userId - User ID
     * @param token - FCM device token to remove
     * @returns Updated user document
     */
    async removeFcmToken(userId: string, token: string): Promise<UserDocument> {
        if (!token) {
            throw new BadRequestException('FCM token is required');
        }

        const user = await this.userModel.findByIdAndUpdate(
            userId,
            { $pull: { fcmTokens: token } },
            { new: true }
        ).exec();

        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }

        return user;
    }

    /**
     * Get all FCM tokens for a user
     * @param userId - User ID
     * @returns Array of FCM tokens
     */
    async getFcmTokens(userId: string): Promise<string[]> {
        const user = await this.userModel.findById(userId).select('fcmTokens').lean().exec();

        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }

        return user.fcmTokens || [];
    }

    /**
     * Get FCM tokens for multiple users
     * @param userIds - Array of user IDs
     * @returns Map of userId -> tokens[]
     */
    async getFcmTokensForUsers(userIds: string[]): Promise<Map<string, string[]>> {
        const users = await this.userModel
            .find({ _id: { $in: userIds.map(id => new Types.ObjectId(id)) } })
            .select('_id fcmTokens')
            .lean()
            .exec();

        const tokenMap = new Map<string, string[]>();
        users.forEach(user => {
            tokenMap.set(user._id.toString(), user.fcmTokens || []);
        });

        return tokenMap;
    }
}
