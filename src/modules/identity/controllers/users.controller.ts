import { Controller, Get, Param, Patch, Body, Post, Delete, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from '../services/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { SetDefaultAddressDto } from '../dto/set-default-address.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get(':id')
    async getUser(@Param('id') id: string) {
        const user = await this.usersService.findByIdWithProfileUrl(id);
        return {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isVerified: user.isVerified,
            kycStatus: user.kycStatus,
            // Expose user preferences so frontend can render and manage them
            preferences: user.preferences,
            // Also expose defaultAddressId for completeness
            defaultAddressId: user.defaultAddressId,
            // Include addresses array
            addresses: user.addresses || [],
            // Include profile picture URL
            profilePictureUrl: user.profilePictureUrl,
        };
    }

    // 🎯 Get only the user's preferences
    @Get(':id/preferences')
    async getUserPreferences(@Param('id') id: string) {
        const user = await this.usersService.findById(id);
        return {
            preferences: user.preferences,
        };
    }

    // 🔄 Update user details
    @Patch(':id')
    async updateUser(@Param('id') id: string, @Body() updateDto: UpdateUserDto) {
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
            },
        };
    }

    // 🛠️ Update only the user's preferences (safe and isolated)
    @Patch(':id/preferences')
    async updatePreferences(@Param('id') id: string, @Body() preferencesDto: UpdatePreferencesDto) {
        const user = await this.usersService.updatePreferences(id, preferencesDto);
        return {
            message: 'Preferences updated successfully',
            preferences: user.preferences,
        };
    }

    // ✅ Verify user (set isVerified to true)
    @Patch(':id/verify')
    async verifyUser(@Param('id') id: string) {
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

    // ❌ Unverify user (set isVerified to false)
    @Patch(':id/unverify')
    async unverifyUser(@Param('id') id: string) {
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

    // 📱 Check if phone number exists in database
    @Get('check-phone/:phone')
    async checkPhoneExists(@Param('phone') phone: string) {
        const user = await this.usersService.findByPhone(phone);
        return {
            phone: phone,
            exists: !!user,
            message: user ? 'Phone number is registered' : 'Phone number is not registered',
        };
    }

    // 🔍 Debug endpoint to check all users with phone numbers
    @Get('debug/phones')
    async getAllUsersWithPhones() {
        const users = await this.usersService.getAllUsersWithPhones();
        return {
            message: 'All users with phone numbers',
            users: users.map((user) => ({
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
            })),
        };
    }

    // 📸 Profile Picture Endpoints
    @Post(':id/profile-picture')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
            },
            fileFilter: (req, file, callback) => {
                if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
                    return callback(new BadRequestException('Only image files are allowed!'), false);
                }
                callback(null, true);
            },
        })
    )
    @ApiOperation({ summary: 'Upload profile picture' })
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
    async uploadProfilePicture(@Param('id') userId: string, @UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        try {
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
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new BadRequestException(`Failed to upload profile picture: ${message}`);
        }
    }

    @Delete(':id/profile-picture')
    @ApiOperation({ summary: 'Delete profile picture' })
    async deleteProfilePicture(@Param('id') userId: string) {
        try {
            const updatedUser = await this.usersService.deleteProfilePicture(userId);

            return {
                message: 'Profile picture deleted successfully',
                user: {
                    id: updatedUser._id,
                    name: updatedUser.name,
                    profilePictureUrl: null,
                },
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new BadRequestException(`Failed to delete profile picture: ${message}`);
        }
    }

    @Post('fcm-token')
    @ApiOperation({ summary: 'Register FCM device token for push notifications' })
    async registerFcmToken(@Body('token') token: string, @CurrentUser() user: any) {
        if (!token) {
            throw new BadRequestException('Token is required');
        }

        await this.usersService.registerFcmToken(user.userId, token);

        return {
            message: 'FCM token registered successfully',
        };
    }

    @Delete('fcm-token')
    @ApiOperation({ summary: 'Remove FCM device token' })
    async removeFcmToken(@Body('token') token: string, @CurrentUser() user: any) {
        if (!token) {
            throw new BadRequestException('Token is required');
        }

        await this.usersService.removeFcmToken(user.userId, token);

        return {
            message: 'FCM token removed successfully',
        };
    }

    // ==========================================
    // ADDRESS MANAGEMENT ENDPOINTS
    // ==========================================

    @Get(':id/addresses')
    @ApiOperation({ summary: 'Get all addresses for a user' })
    async getUserAddresses(@Param('id') userId: string) {
        const addresses = await this.usersService.getUserAddresses(userId);
        return {
            addresses,
        };
    }

    @Get(':userId/addresses/:addressId')
    @ApiOperation({ summary: 'Get a specific address' })
    async getAddress(@Param('userId') userId: string, @Param('addressId') addressId: string) {
        const address = await this.usersService.getAddressById(userId, addressId);
        return {
            address,
        };
    }

    @Post(':id/addresses')
    @ApiOperation({ summary: 'Create a new address for a user' })
    async createAddress(@Param('id') userId: string, @Body() createAddressDto: CreateAddressDto) {
        const address = await this.usersService.createAddress(userId, createAddressDto);
        return {
            message: 'Address created successfully',
            address,
        };
    }

    @Patch(':userId/addresses/:addressId')
    @ApiOperation({ summary: 'Update an existing address' })
    async updateAddress(
        @Param('userId') userId: string,
        @Param('addressId') addressId: string,
        @Body() updateAddressDto: UpdateAddressDto
    ) {
        const address = await this.usersService.updateAddress(userId, addressId, updateAddressDto);
        return {
            message: 'Address updated successfully',
            address,
        };
    }

    @Delete(':userId/addresses/:addressId')
    @ApiOperation({ summary: 'Delete an address' })
    async deleteAddress(@Param('userId') userId: string, @Param('addressId') addressId: string) {
        await this.usersService.deleteAddress(userId, addressId);
        return {
            message: 'Address deleted successfully',
        };
    }

    @Patch(':id/default-address')
    @ApiOperation({ summary: 'Set an address as default' })
    async setDefaultAddress(@Param('id') userId: string, @Body() setDefaultAddressDto: SetDefaultAddressDto) {
        const user = await this.usersService.setDefaultAddressById(userId, setDefaultAddressDto.addressId);
        return {
            message: 'Default address updated successfully',
            defaultAddressId: user.defaultAddressId,
        };
    }
}
