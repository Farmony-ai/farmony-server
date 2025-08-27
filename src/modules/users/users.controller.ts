import { Controller, Get, Param, Patch, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
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
      defaultAddressId: user.defaultAddressId
    };
  }

  // 🎯 Get only the user's preferences
  @Get(':id/preferences')
  async getUserPreferences(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return {
      preferences: user.preferences
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
        kycStatus: user.kycStatus
      }
    };
  }

  // 🛠️ Update only the user's preferences (safe and isolated)
  @Patch(':id/preferences')
  async updatePreferences(
    @Param('id') id: string,
    @Body() preferencesDto: UpdatePreferencesDto
  ) {
    const user = await this.usersService.updatePreferences(id, preferencesDto);
    return {
      message: 'Preferences updated successfully',
      preferences: user.preferences
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
        isVerified: user.isVerified
      }
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
        isVerified: user.isVerified
      }
    };
  }

  // 📱 Check if phone number exists in database
  @Get('check-phone/:phone')
  async checkPhoneExists(@Param('phone') phone: string) {
    const user = await this.usersService.findByPhone(phone);
    return {
      phone: phone,
      exists: !!user,
      message: user ? 'Phone number is registered' : 'Phone number is not registered'
    };
  }

  // 🔍 Debug endpoint to check all users with phone numbers
  @Get('debug/phones')
  async getAllUsersWithPhones() {
    const users = await this.usersService.getAllUsersWithPhones();
    return {
      message: 'All users with phone numbers',
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }))
    };
  }
}