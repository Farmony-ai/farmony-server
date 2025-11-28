import {
    Controller,
    Get,
    Param,
    Patch,
    Body,
    Post,
    Delete,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    UseGuards,
    Query,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from '../services/users.service';
import { AddressService } from '../services/address.service';
import { FcmTokenService } from '../services/fcm-token.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { SetDefaultAddressDto } from '../dto/set-default-address.dto';
import { FcmTokenDto } from '../dto/fcm-token.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { OwnershipGuard } from '../guards/ownership.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Public } from '../../common/decorators/public.decorator';
import { ListingsService } from '../../marketplace/listings/services/listings.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly addressService: AddressService,
        private readonly fcmTokenService: FcmTokenService,
        @Inject(forwardRef(() => ListingsService)) private readonly listingsService: ListingsService,
    ) { }

    @Get('providers/map')
    @Public()
    @ApiOperation({ summary: 'Get providers within a map bounding box' })
    async getMapProviders(
        @Query('minLat') minLat: string,
        @Query('maxLat') maxLat: string,
        @Query('minLng') minLng: string,
        @Query('maxLng') maxLng: string,
    ) {
        if (!minLat || !maxLat || !minLng || !maxLng) {
            return [];
        }

        const bounds = {
            minLat: parseFloat(minLat),
            maxLat: parseFloat(maxLat),
            minLng: parseFloat(minLng),
            maxLng: parseFloat(maxLng),
        };

        if (isNaN(bounds.minLat) || isNaN(bounds.maxLat) || isNaN(bounds.minLng) || isNaN(bounds.maxLng)) {
            return [];
        }

        const providers = await this.usersService.findProvidersInBoundingBox(bounds);

        // Enrich providers with listing categories
        const enrichedProviders = await Promise.all(
            providers.map(async (provider: any) => {
                const listings = await this.listingsService.findByProvider(provider._id.toString());

                const categories = new Set<string>();
                const subCategories = new Set<string>();

                listings.forEach((listing: any) => {
                    if (listing.isActive) {
                        if (listing.categoryId?.name) categories.add(listing.categoryId.name);
                        if (listing.subCategoryId?.name) subCategories.add(listing.subCategoryId.name);
                    }
                });

                return {
                    ...provider,
                    categories: Array.from(categories),
                    subCategories: Array.from(subCategories),
                };
            })
        );

        // Filter out providers with no active listings (categories)
        return enrichedProviders.filter(p => p.categories.length > 0);
    }

    // ==========================================
    // PUBLIC ENDPOINTS (no auth required)
    // ==========================================

    @Get('check-phone/:phone')
    @ApiOperation({ summary: 'Check if phone number is registered' })
    async checkPhoneExists(@Param('phone') phone: string) {
        const user = await this.usersService.findByPhone(phone);
        return {
            phone: phone,
            exists: !!user,
            message: user ? 'Phone number is registered' : 'Phone number is not registered',
        };
    }

    // ==========================================
    // AUTHENTICATED USER ENDPOINTS
    // ==========================================

    @UseGuards(FirebaseAuthGuard)
    @Get('me')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current authenticated user profile' })
    async getCurrentUser(@CurrentUser() currentUser: any) {
        const user = await this.usersService.findByIdWithProfileUrl(currentUser.userId);
        return {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isVerified: user.isVerified,
            kycStatus: user.kycStatus,
            gender: user.gender,
            dateOfBirth: user.dateOfBirth,
            bio: user.bio,
            occupation: user.occupation,
            preferences: user.preferences,
            defaultAddressId: user.defaultAddressId,
            addresses: user.addresses || [],
            profilePictureUrl: user.profilePictureUrl,
        };
    }

    @UseGuards(FirebaseAuthGuard)
    @Get(':id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get user by ID' })
    async getUser(@Param('id', ParseMongoIdPipe) id: string) {
        const user = await this.usersService.findByIdWithProfileUrl(id);
        return {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isVerified: user.isVerified,
            kycStatus: user.kycStatus,
            gender: user.gender,
            dateOfBirth: user.dateOfBirth,
            bio: user.bio,
            occupation: user.occupation,
            preferences: user.preferences,
            defaultAddressId: user.defaultAddressId,
            addresses: user.addresses || [],
            profilePictureUrl: user.profilePictureUrl,
        };
    }

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Get(':id/preferences')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get user preferences (owner or admin only)' })
    async getUserPreferences(@Param('id', ParseMongoIdPipe) id: string) {
        const user = await this.usersService.findById(id);
        return {
            preferences: user.preferences,
        };
    }

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Patch(':id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update user profile (owner or admin only)' })
    async updateUser(@Param('id', ParseMongoIdPipe) id: string, @Body() updateDto: UpdateUserDto) {
        const user = await this.usersService.updateUser(id, updateDto);
        return {
            message: 'User updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isVerified: user.isVerified,
                kycStatus: user.kycStatus,
                gender: user.gender,
                dateOfBirth: user.dateOfBirth,
                bio: user.bio,
                occupation: user.occupation,
            },
        };
    }

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Patch(':id/preferences')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update user preferences (owner or admin only)' })
    async updatePreferences(@Param('id', ParseMongoIdPipe) id: string, @Body() preferencesDto: UpdatePreferencesDto) {
        const user = await this.usersService.updatePreferences(id, preferencesDto);
        return {
            message: 'Preferences updated successfully',
            preferences: user.preferences,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                preferences: user.preferences,
            },
        };
    }

    // ==========================================
    // ADMIN-ONLY ENDPOINTS
    // ==========================================

    @UseGuards(FirebaseAuthGuard, RolesGuard)
    @Roles('admin')
    @Patch(':id/verify')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Verify a user (admin only)' })
    async verifyUser(@Param('id', ParseMongoIdPipe) id: string) {
        const user = await this.usersService.verifyUser(id);
        return {
            message: 'User verified successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                isVerified: user.isVerified,
            },
        };
    }

    @UseGuards(FirebaseAuthGuard, RolesGuard)
    @Roles('admin')
    @Patch(':id/unverify')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Unverify a user (admin only)' })
    async unverifyUser(@Param('id', ParseMongoIdPipe) id: string) {
        const user = await this.usersService.unverifyUser(id);
        return {
            message: 'User unverified successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                isVerified: user.isVerified,
            },
        };
    }

    // ==========================================
    // PROFILE PICTURE
    // ==========================================

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Post(':id/profile-picture')
    @ApiBearerAuth()
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: {
                fileSize: 5 * 1024 * 1024,
            },
            fileFilter: (req, file, callback) => {
                if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
                    return callback(new BadRequestException('Only image files are allowed!'), false);
                }
                callback(null, true);
            },
        }),
    )
    @ApiOperation({ summary: 'Upload profile picture (owner or admin only)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    async uploadProfilePicture(
        @Param('id', ParseMongoIdPipe) userId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        const { user, url } = await this.usersService.uploadProfilePicture(userId, file);

        return {
            message: 'Profile picture uploaded successfully',
            profilePictureUrl: url,
            user: {
                id: user._id,
                name: user.name,
                profilePictureUrl: url,
            },
        };
    }

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Delete(':id/profile-picture')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete profile picture (owner or admin only)' })
    async deleteProfilePicture(@Param('id', ParseMongoIdPipe) userId: string) {
        const updatedUser = await this.usersService.deleteProfilePicture(userId);

        return {
            message: 'Profile picture deleted successfully',
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                profilePictureUrl: null,
            },
        };
    }

    // ==========================================
    // FCM TOKENS
    // ==========================================

    @UseGuards(FirebaseAuthGuard)
    @Post('fcm-token')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Register FCM device token for push notifications' })
    async registerFcmToken(@Body() dto: FcmTokenDto, @CurrentUser() user: any) {
        await this.fcmTokenService.registerToken(user.userId, dto.token);

        return {
            message: 'FCM token registered successfully',
        };
    }

    @UseGuards(FirebaseAuthGuard)
    @Delete('fcm-token')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove FCM device token' })
    async removeFcmToken(@Body() dto: FcmTokenDto, @CurrentUser() user: any) {
        await this.fcmTokenService.removeToken(user.userId, dto.token);

        return {
            message: 'FCM token removed successfully',
        };
    }

    // ==========================================
    // ADDRESS MANAGEMENT
    // ==========================================

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Get(':id/addresses')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all addresses for a user (owner or admin only)' })
    async getUserAddresses(@Param('id', ParseMongoIdPipe) userId: string) {
        const addresses = await this.addressService.getUserAddresses(userId);
        return {
            addresses,
        };
    }

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Get(':userId/addresses/:addressId')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get a specific address (owner or admin only)' })
    async getAddress(
        @Param('userId', ParseMongoIdPipe) userId: string,
        @Param('addressId', ParseMongoIdPipe) addressId: string,
    ) {
        const address = await this.addressService.getAddressById(userId, addressId);
        return {
            address,
        };
    }

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Post(':id/addresses')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new address for a user (owner or admin only)' })
    async createAddress(
        @Param('id', ParseMongoIdPipe) userId: string,
        @Body() createAddressDto: CreateAddressDto,
    ) {
        const address = await this.addressService.createAddress(userId, createAddressDto);
        return {
            message: 'Address created successfully',
            address,
        };
    }

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Patch(':userId/addresses/:addressId')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update an existing address (owner or admin only)' })
    async updateAddress(
        @Param('userId', ParseMongoIdPipe) userId: string,
        @Param('addressId', ParseMongoIdPipe) addressId: string,
        @Body() updateAddressDto: UpdateAddressDto,
    ) {
        const address = await this.addressService.updateAddress(userId, addressId, updateAddressDto);
        return {
            message: 'Address updated successfully',
            address,
        };
    }

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Delete(':userId/addresses/:addressId')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete an address (owner or admin only)' })
    async deleteAddress(
        @Param('userId', ParseMongoIdPipe) userId: string,
        @Param('addressId', ParseMongoIdPipe) addressId: string,
    ) {
        await this.addressService.deleteAddress(userId, addressId);
        return {
            message: 'Address deleted successfully',
        };
    }

    @UseGuards(FirebaseAuthGuard, OwnershipGuard)
    @Patch(':id/default-address')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Set an address as default (owner or admin only)' })
    async setDefaultAddress(
        @Param('id', ParseMongoIdPipe) userId: string,
        @Body() setDefaultAddressDto: SetDefaultAddressDto,
    ) {
        const user = await this.addressService.setDefaultAddress(userId, setDefaultAddressDto.addressId);
        return {
            message: 'Default address updated successfully',
            defaultAddressId: user.defaultAddressId,
        };
    }
}
