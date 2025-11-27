import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { OtpLoginDto } from './dto/otp-login.dto';
import { LoginDto } from './dto/login.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  // In-memory storage for refresh tokens (consider using Redis in production)
  private refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(loginDto: LoginDto) {
    const { email, phone, password } = loginDto;

    if (!email && !phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    let user;
    if (email) {
      user = await this.usersService.findByEmail(email);
    } else if (phone) {
      user = await this.usersService.findByPhone(phone);
    }

    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    const { password: userPassword, ...result } = user.toObject();
    console.log(`User ${user.name} authenticated successfully`);
    return result;
  }

  async login(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.generateRefreshToken(user._id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 minutes in seconds
      token_type: 'Bearer',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async register(createDto: CreateUserDto) {
    const user = await this.usersService.create(createDto);
    const { password, ...result } = user.toObject();
    
    // Auto-login after registration
    const payload = { email: user.email, sub: user._id };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.generateRefreshToken(user._id.toString());
    
    return {
      user: result,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
      token_type: 'Bearer',
    };
  }

  async otpLogin(otpLoginDto: OtpLoginDto) {
    const { email, phone } = otpLoginDto;

    if (!email && !phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    let user;
    if (email) {
      user = await this.usersService.findByEmail(email);
      if (!user) {
        console.log(`Email ${email} not found in database`);
        throw new NotFoundException('Email not registered');
      }
      console.log(`Email ${email} found for user: ${user.email}`);
    } else if (phone) {
      user = await this.usersService.findByPhone(phone);
      if (!user) {
        console.log(`Phone number ${phone} not found in database`);
        throw new NotFoundException('Phone number not registered');
      }
      console.log(`Phone number ${phone} found for user: ${user.email}`);
    }

    // Mark user as verified (if not already)
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
      console.log(`User ${user.email} marked as verified`);
    }

    // Generate tokens
    const payload = {
      id: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      sub: user._id,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.generateRefreshToken(user._id.toString());

    // Return success response (maintaining backward compatibility)
    return {
      message: 'OTP login successful',
      token: accessToken, // For backward compatibility
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
      token_type: 'Bearer',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        kycStatus: user.kycStatus,
        createdAt: (user as any).createdAt,
        updatedAt: (user as any).updatedAt,
      },
    };
  }

  private generateRefreshToken(userId: string): string {
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Refresh token valid for 30 days

    this.refreshTokens.set(refreshToken, {
      userId,
      expiresAt
    });

    // Clean up expired tokens periodically
    this.cleanupExpiredTokens();

    return refreshToken;
  }

  async refreshToken(refreshToken: string) {
    const tokenData = this.refreshTokens.get(refreshToken);

    if (!tokenData) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > tokenData.expiresAt) {
      this.refreshTokens.delete(refreshToken);
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.usersService.findById(tokenData.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Delete old refresh token
    this.refreshTokens.delete(refreshToken);

    // Generate new tokens with the same payload structure as login
    const payload = {
      sub: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    const newAccessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const newRefreshToken = this.generateRefreshToken(user._id.toString());

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 900,
      token_type: 'Bearer',
    };
  }

  private cleanupExpiredTokens() {
    const now = new Date();
    for (const [token, data] of this.refreshTokens.entries()) {
      if (now > data.expiresAt) {
        this.refreshTokens.delete(token);
      }
    }
  }

  // Optional: Add method to revoke all refresh tokens for a user
  async revokeUserTokens(userId: string) {
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.userId === userId) {
        this.refreshTokens.delete(token);
      }
    }
  }

  // Optional: Add method to validate current access token
  async validateToken(token: string): Promise<any> {
    try {
      const decoded = this.jwtService.verify(token);
      return { valid: true, user: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}