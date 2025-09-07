import { Controller, Get, Param, Patch, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

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
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      role: user.role,
      isVerified: user.isVerified,
      kycStatus: user.kycStatus
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
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        role: user.role,
        isVerified: user.isVerified,
        kycStatus: user.kycStatus
      }
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