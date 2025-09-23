import { Injectable, BadRequestException, NotFoundException} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { S3Service } from '../aws/s3.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly s3Service: S3Service,
  ) {}

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
        notificationsEnabled: true
      }
    });
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    console.log(`Searching for phone: ${phone}`);
    const user = await this.userModel.findOne({ phone }).exec();
    console.log(`Found user: ${user ? user.name : 'null'}`);
    return user;
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
      profilePictureUrl: user.profilePicture ? this.s3Service.getPublicUrl(user.profilePicture) : undefined
    };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<User> {
    const user = await this.findById(userId);
    
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
    user.defaultAddressId = addressId as any;
    return user.save();
  }

  async getUserWithAddress(userId: string): Promise<any> {
    return this.userModel
      .findById(userId)
      .populate('defaultAddressId')
      .exec();
  }



  

  // 🔄 Update user fields (including isVerified)
  async updateUser(id: string, updateDto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      updateDto,
      { new: true, runValidators: true }
    ).exec();
    
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
  async updateProfilePicture(userId: string, s3Key: string): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { profilePicture: s3Key },
      { new: true, runValidators: true }
    ).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deleteProfilePicture(userId: string): Promise<UserDocument> {
    const user = await this.findById(userId);

    // Delete the file from S3 if it exists
    if (user.profilePicture) {
      try {
        await this.s3Service.deleteFile(user.profilePicture);
      } catch (error) {
        console.error('Error deleting profile picture from S3:', error);
        // Continue with database update even if S3 deletion fails
      }
    }

    // Update user document to remove profile picture reference
    user.profilePicture = undefined;
    return user.save();
  }
}