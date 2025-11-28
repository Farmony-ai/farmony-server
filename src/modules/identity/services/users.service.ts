import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/users.schema';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { FirebaseStorageService } from '../../common/firebase/firebase-storage.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly storageService: FirebaseStorageService,
    ) { }

    // ============================================
    // USER CRUD
    // ============================================

    async create(createDto: CreateUserDto): Promise<UserDocument> {
        const firebaseUserExists = await this.userModel.findOne({ firebaseUserId: createDto.firebaseUserId });
        if (firebaseUserExists) {
            throw new BadRequestException('Firebase user already registered');
        }

        if (createDto.email) {
            const emailExists = await this.userModel.findOne({ email: createDto.email });
            if (emailExists) {
                throw new BadRequestException('Email already in use');
            }
        }

        if (createDto.phone) {
            const phoneExists = await this.userModel.findOne({ phone: createDto.phone });
            if (phoneExists) {
                throw new BadRequestException('Phone number already in use');
            }
        }

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

    async findByFirebaseUserId(firebaseUserId: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ firebaseUserId }).exec();
    }

    async findById(id: string): Promise<UserDocument> {
        const user = await this.userModel.findById(id).exec();
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async findByIdWithProfileUrl(id: string): Promise<UserDocument & { profilePictureUrl?: string }> {
        const user = await this.findById(id);
        const userObj = user.toObject();
        return {
            ...userObj,
            profilePictureUrl: this.storageService.getPublicUrl(user.profilePictureKey) || undefined,
        };
    }

    async updateUser(id: string, updateDto: UpdateUserDto): Promise<UserDocument> {
        const user = await this.userModel
            .findByIdAndUpdate(id, updateDto, { new: true, runValidators: true })
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async verifyUser(id: string): Promise<UserDocument> {
        const user = await this.userModel
            .findByIdAndUpdate(id, { isVerified: true }, { new: true })
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async unverifyUser(id: string): Promise<UserDocument> {
        const user = await this.userModel
            .findByIdAndUpdate(id, { isVerified: false }, { new: true })
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async getAllUsersWithPhones(): Promise<UserDocument[]> {
        return this.userModel.find({}, 'email phone name').exec();
    }

    // ============================================
    // USER PREFERENCES
    // ============================================

    async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<UserDocument> {
        const user = await this.findById(userId);

        user.preferences = {
            ...user.preferences,
            ...Object.fromEntries(
                Object.entries(dto).filter(([_, v]) => v !== undefined)
            ),
        } as typeof user.preferences;

        return user.save();
    }

    // ============================================
    // PROFILE PICTURE
    // ============================================

    async uploadProfilePicture(
        userId: string,
        file: Express.Multer.File,
    ): Promise<{ user: UserDocument; key: string; url: string | null }> {
        const user = await this.findById(userId);

        if (!file?.buffer) {
            throw new BadRequestException('Uploaded file is empty');
        }

        const previousKey = user.profilePictureKey;
        const key = await this.storageService.uploadFile(file, `profile-pictures/${userId}`);

        user.profilePictureKey = key;
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

        if (user.profilePictureKey) {
            await this.storageService.deleteFile(user.profilePictureKey);
        }

        user.profilePictureKey = undefined;
        return user.save();
    }

    /**
     * Find providers within a bounding box
     * Searches based on default address or any active address
     */
    async findProvidersInBoundingBox(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<any[]> {
        const { minLat, maxLat, minLng, maxLng } = bounds;

        // Find users who have role='provider' AND have an address in the box
        const query = {
            role: { $in: ['provider', 'individual', 'SHG', 'FPO'] },
            'addresses.location': {
                $geoWithin: {
                    $box: [
                        [minLng, minLat],
                        [maxLng, maxLat]
                    ]
                }
            }
        };

        const users = await this.userModel
            .find(query)
            .select('_id name phone role addresses defaultAddressId profilePictureKey')
            .lean()
            .limit(500);

        // Transform to return only the relevant location (the one in the box)
        return users.map(user => {
            // Find the address that matched (or just take the first one in bounds)
            const validAddress = user.addresses?.find((addr: any) => {
                const [lng, lat] = addr.location?.coordinates || [];
                return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
            });

            return {
                _id: user._id,
                name: user.name,
                phone: user.phone,
                location: validAddress?.location,
                profilePictureUrl: this.storageService.getPublicUrl(user.profilePictureKey),
            };
        });
    }
}
