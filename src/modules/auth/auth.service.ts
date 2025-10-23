import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { OtpLoginDto } from './dto/otp-login.dto';
import { LoginDto } from './dto/login.dto';
import { v4 as uuidv4 } from 'uuid';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';
import { TOKEN_CONFIG } from './constants';

export interface TokenMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshTokenDocument>,
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

  async login(user: any, metadata?: TokenMetadata) {
    const payload = {
      sub: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY });
    const refreshToken = await this.generateRefreshToken(user._id.toString(), undefined, metadata);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS,
      token_type: 'Bearer',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async register(createDto: CreateUserDto, metadata?: TokenMetadata) {
    const user = await this.usersService.create(createDto);
    const { password, ...result } = user.toObject();

    // Auto-login after registration
    const payload = {
      sub: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY });
    const refreshToken = await this.generateRefreshToken(user._id.toString(), undefined, metadata);

    return {
      user: result,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS,
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

    const accessToken = this.jwtService.sign(payload, { expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY });
    const refreshToken = await this.generateRefreshToken(user._id.toString());

    // Return success response (maintaining backward compatibility)
    return {
      message: 'OTP login successful',
      token: accessToken, // For backward compatibility
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS,
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

  private async generateRefreshToken(
    userId: string,
    family?: string,
    metadata?: TokenMetadata,
  ): Promise<string> {
    const token = uuidv4();
    const tokenFamily = family || uuidv4(); // Create or reuse family for rotation tracking
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS);

    // Save to database
    await this.refreshTokenModel.create({
      token,
      userId: new Types.ObjectId(userId),
      expiresAt,
      issuedAt: new Date(),
      family: tokenFamily,
      metadata,
    });

    return token;
  }

  async refreshToken(refreshToken: string, metadata?: TokenMetadata) {
    // 1. Validate refresh token
    const tokenDoc = await this.refreshTokenModel.findOne({
      token: refreshToken,
      isRevoked: false,
    });

    if (!tokenDoc) {
      // Check if token was revoked (reuse detection)
      const revokedToken = await this.refreshTokenModel.findOne({ token: refreshToken });
      if (revokedToken?.isRevoked) {
        // Token reuse detected! Revoke entire family for security
        await this.revokeTokenFamily(revokedToken.family);
        this.logger.warn(`Token reuse detected for family ${revokedToken.family}`);
        throw new UnauthorizedException('Token reuse detected. Please login again.');
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 2. Check expiry
    if (new Date() > tokenDoc.expiresAt) {
      await tokenDoc.updateOne({ isRevoked: true, revokedAt: new Date() });
      throw new UnauthorizedException('Refresh token expired');
    }

    // 3. Get user
    const user = await this.usersService.findById(tokenDoc.userId.toString());
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 4. Revoke old token (rotation)
    tokenDoc.isRevoked = true;
    tokenDoc.revokedAt = new Date();

    // 5. Generate NEW tokens (sliding window - extends 30d from now)
    const newRefreshToken = await this.generateRefreshToken(
      user._id.toString(),
      tokenDoc.family, // Same family for rotation tracking
      metadata,
    );

    // 6. Track replacement chain
    tokenDoc.replacedBy = newRefreshToken;
    await tokenDoc.save();

    const payload = {
      sub: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    const newAccessToken = this.jwtService.sign(payload, {
      expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS,
      token_type: 'Bearer',
    };
  }

  private async revokeTokenFamily(family: string): Promise<void> {
    // Security: revoke all tokens in the family if reuse detected
    await this.refreshTokenModel.updateMany(
      { family, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );
    this.logger.warn(`Revoked token family ${family} due to reuse detection`);
  }

  // Cleanup cron job - runs daily at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredTokens() {
    const deleted = await this.refreshTokenModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    this.logger.log(`Cleaned up ${deleted.deletedCount} expired refresh tokens`);
  }

  // Revoke all refresh tokens for a user (for logout)
  async revokeUserTokens(userId: string) {
    await this.refreshTokenModel.updateMany(
      { userId: new Types.ObjectId(userId), isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );
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