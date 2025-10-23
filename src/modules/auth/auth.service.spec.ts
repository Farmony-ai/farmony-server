import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { RefreshToken } from './schemas/refresh-token.schema';
import { LoginDto } from './dto/login.dto';
import { OtpLoginDto } from './dto/otp-login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { TOKEN_CONFIG } from './constants';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const mockUserId = new Types.ObjectId('507f1f77bcf86cd799439011');
const mockRefreshToken = 'mock-uuid-v4-token';
const mockAccessToken = 'mock-jwt-access-token';
const mockFamily = 'mock-family-uuid';

const mockUser = {
  _id: mockUserId,
  email: 'test@example.com',
  phone: '1234567890',
  name: 'Test User',
  password: 'hashedPassword',
  role: 'user',
  isVerified: false,
  kycStatus: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
  toObject: function() {
    const { password, ...rest } = this;
    return rest;
  },
  save: jest.fn().mockResolvedValue(this),
};

const mockRefreshTokenDoc = {
  _id: new Types.ObjectId(),
  token: mockRefreshToken,
  userId: mockUserId,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  issuedAt: new Date(),
  isRevoked: false,
  family: mockFamily,
  metadata: {
    ipAddress: '127.0.0.1',
    userAgent: 'Jest Test',
    deviceId: 'test-device',
  },
  save: jest.fn(),
  updateOne: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let refreshTokenModel: Model<RefreshToken>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByPhone: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => mockAccessToken),
            verify: jest.fn(),
          },
        },
        {
          provide: getModelToken(RefreshToken.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    refreshTokenModel = module.get<Model<RefreshToken>>(getModelToken(RefreshToken.name));

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('should validate user with email and password', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      const loginDto: LoginDto = { email: 'test@example.com', password: 'password' };
      const result = await service.validateUser(loginDto);

      expect(result).toEqual(expect.objectContaining({
        email: mockUser.email,
        phone: mockUser.phone,
        name: mockUser.name,
      }));
      expect(result).not.toHaveProperty('password');
      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
    });

    it('should validate user with phone and password', async () => {
      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(mockUser as any);
      const loginDto: LoginDto = { phone: '1234567890', password: 'password' };
      const result = await service.validateUser(loginDto);

      expect(result).toEqual(expect.objectContaining({
        phone: mockUser.phone,
        email: mockUser.email,
      }));
      expect(result).not.toHaveProperty('password');
      expect(usersService.findByPhone).toHaveBeenCalledWith(loginDto.phone);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const loginDto: LoginDto = { email: 'test@example.com', password: 'wrongpassword' };

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException if user not found by email', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      const loginDto: LoginDto = { email: 'nonexistent@example.com', password: 'password' };

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException if user not found by phone', async () => {
      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(null);
      const loginDto: LoginDto = { phone: '0987654321', password: 'password' };

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw BadRequestException if neither email nor phone is provided', async () => {
      const loginDto: LoginDto = { password: 'password' } as any;

      await expect(service.validateUser(loginDto)).rejects.toThrow(BadRequestException);
      await expect(service.validateUser(loginDto)).rejects.toThrow('Either email or phone must be provided');
    });
  });

  describe('login', () => {
    beforeEach(() => {
      jest.spyOn(refreshTokenModel, 'create').mockResolvedValue(mockRefreshTokenDoc as any);
    });

    it('should return access token, refresh token, and user details', async () => {
      const result = await service.login(mockUser);

      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: expect.any(String),
        expires_in: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS,
        token_type: 'Bearer',
        user: {
          id: mockUser._id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
        },
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: mockUser._id,
          email: mockUser.email,
          phone: mockUser.phone,
          role: mockUser.role,
        },
        { expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY }
      );

      expect(refreshTokenModel.create).toHaveBeenCalled();
    });

    it('should generate refresh token with correct expiry (30 days)', async () => {
      await service.login(mockUser);

      const createCall = (refreshTokenModel.create as jest.Mock).mock.calls[0][0];
      expect(createCall.expiresAt).toBeInstanceOf(Date);

      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS);

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(createCall.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    it('should store token metadata when provided', async () => {
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-123',
      };

      await service.login(mockUser, metadata);

      const createCall = (refreshTokenModel.create as jest.Mock).mock.calls[0][0];
      expect(createCall.metadata).toEqual(metadata);
    });

    it('should create refresh token with new family on first login', async () => {
      await service.login(mockUser);

      const createCall = (refreshTokenModel.create as jest.Mock).mock.calls[0][0];
      expect(createCall.family).toBeDefined();
      expect(typeof createCall.family).toBe('string');
    });
  });

  describe('register', () => {
    const createUserDto: CreateUserDto = {
      name: 'New User',
      email: 'newuser@example.com',
      password: 'password123',
      phone: '9876543210',
      role: 'user',
    };

    beforeEach(() => {
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser as any);
      jest.spyOn(refreshTokenModel, 'create').mockResolvedValue(mockRefreshTokenDoc as any);
    });

    it('should create new user and return tokens', async () => {
      const result = await service.register(createUserDto);

      expect(result).toEqual({
        user: expect.objectContaining({
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
        }),
        access_token: mockAccessToken,
        refresh_token: expect.any(String),
        expires_in: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS,
        token_type: 'Bearer',
      });

      expect(result.user).not.toHaveProperty('password');
      expect(usersService.create).toHaveBeenCalledWith(createUserDto);
    });

    it('should auto-login user after registration', async () => {
      const result = await service.register(createUserDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: mockUser._id,
          email: mockUser.email,
          phone: mockUser.phone,
          role: mockUser.role,
        },
        { expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY }
      );

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });

    it('should handle registration with metadata', async () => {
      const metadata = {
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome',
        deviceId: 'chrome-device',
      };

      await service.register(createUserDto, metadata);

      const createCall = (refreshTokenModel.create as jest.Mock).mock.calls[0][0];
      expect(createCall.metadata).toEqual(metadata);
    });
  });

  describe('otpLogin', () => {
    beforeEach(() => {
      jest.spyOn(refreshTokenModel, 'create').mockResolvedValue(mockRefreshTokenDoc as any);
      mockUser.isVerified = false;
      mockUser.save = jest.fn().mockResolvedValue(mockUser);
    });

    it('should successfully log in with phone number and mark user as verified', async () => {
      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(mockUser as any);
      const otpLoginDto: OtpLoginDto = { phone: '1234567890' };

      const result = await service.otpLogin(otpLoginDto);

      expect(usersService.findByPhone).toHaveBeenCalledWith(otpLoginDto.phone);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.message).toBe('OTP login successful');
      expect(result.token).toBe(mockAccessToken); // Backward compatibility
      expect(result.access_token).toBe(mockAccessToken);
      expect(result.refresh_token).toBeDefined();
      expect(result.user.phone).toBe(mockUser.phone);
      expect(result.user.isVerified).toBe(true);
    });

    it('should successfully log in with email and mark user as verified', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      const otpLoginDto: OtpLoginDto = { email: 'test@example.com' };

      const result = await service.otpLogin(otpLoginDto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(otpLoginDto.email);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.message).toBe('OTP login successful');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should include all user details in response', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      const otpLoginDto: OtpLoginDto = { email: 'test@example.com' };

      const result = await service.otpLogin(otpLoginDto);

      expect(result.user).toEqual({
        id: mockUser._id,
        name: mockUser.name,
        email: mockUser.email,
        phone: mockUser.phone,
        role: mockUser.role,
        isVerified: true,
        kycStatus: mockUser.kycStatus,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should not update user if already verified', async () => {
      mockUser.isVerified = true;
      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(mockUser as any);
      const otpLoginDto: OtpLoginDto = { phone: '1234567890' };

      await service.otpLogin(otpLoginDto);

      expect(mockUser.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if phone number not registered', async () => {
      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(null);
      const otpLoginDto: OtpLoginDto = { phone: '0987654321' };

      await expect(service.otpLogin(otpLoginDto)).rejects.toThrow(NotFoundException);
      await expect(service.otpLogin(otpLoginDto)).rejects.toThrow('Phone number not registered');
    });

    it('should throw NotFoundException if email not registered', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      const otpLoginDto: OtpLoginDto = { email: 'nonexistent@example.com' };

      await expect(service.otpLogin(otpLoginDto)).rejects.toThrow(NotFoundException);
      await expect(service.otpLogin(otpLoginDto)).rejects.toThrow('Email not registered');
    });

    it('should throw BadRequestException if neither email nor phone is provided', async () => {
      const otpLoginDto: OtpLoginDto = {} as any;

      await expect(service.otpLogin(otpLoginDto)).rejects.toThrow(BadRequestException);
      await expect(service.otpLogin(otpLoginDto)).rejects.toThrow('Either email or phone must be provided');
    });
  });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid-refresh-token';
    const expiredRefreshToken = 'expired-refresh-token';
    const revokedRefreshToken = 'revoked-refresh-token';

    beforeEach(() => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(refreshTokenModel, 'create').mockResolvedValue({} as any);
    });

    it('should generate new tokens for valid refresh token', async () => {
      const tokenDoc = {
        ...mockRefreshTokenDoc,
        token: validRefreshToken,
        isRevoked: false,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(refreshTokenModel, 'findOne').mockResolvedValue(tokenDoc as any);

      const result = await service.refreshToken(validRefreshToken);

      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: expect.any(String),
        expires_in: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS,
        token_type: 'Bearer',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: mockUser._id,
          email: mockUser.email,
          phone: mockUser.phone,
          role: mockUser.role,
        },
        { expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY }
      );
    });

    it('should revoke old token and create new one (token rotation)', async () => {
      const tokenDoc = {
        ...mockRefreshTokenDoc,
        token: validRefreshToken,
        isRevoked: false,
        revokedAt: undefined as Date | undefined,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(refreshTokenModel, 'findOne').mockResolvedValue(tokenDoc as any);

      await service.refreshToken(validRefreshToken);

      expect(tokenDoc.isRevoked).toBe(true);
      expect(tokenDoc.revokedAt).toBeInstanceOf(Date);
      expect(tokenDoc.save).toHaveBeenCalled();
      expect(refreshTokenModel.create).toHaveBeenCalled();
    });

    it('should maintain same token family across rotation', async () => {
      const tokenDoc = {
        ...mockRefreshTokenDoc,
        token: validRefreshToken,
        family: 'original-family-uuid',
        isRevoked: false,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(refreshTokenModel, 'findOne').mockResolvedValue(tokenDoc as any);

      await service.refreshToken(validRefreshToken);

      const createCall = (refreshTokenModel.create as jest.Mock).mock.calls[0][0];
      expect(createCall.family).toBe('original-family-uuid');
    });

    it('should track replacement chain with replacedBy field', async () => {
      const tokenDoc = {
        ...mockRefreshTokenDoc,
        token: validRefreshToken,
        isRevoked: false,
        replacedBy: undefined,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(refreshTokenModel, 'findOne').mockResolvedValue(tokenDoc as any);

      await service.refreshToken(validRefreshToken);

      expect(tokenDoc.replacedBy).toBeDefined();
      expect(tokenDoc.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredTokenDoc = {
        ...mockRefreshTokenDoc,
        token: expiredRefreshToken,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        isRevoked: false,
        updateOne: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(refreshTokenModel, 'findOne').mockResolvedValue(expiredTokenDoc as any);

      await expect(service.refreshToken(expiredRefreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(expiredRefreshToken)).rejects.toThrow('Refresh token expired');

      expect(expiredTokenDoc.updateOne).toHaveBeenCalledWith({
        isRevoked: true,
        revokedAt: expect.any(Date),
      });
    });

    it('should throw UnauthorizedException for invalid token (not found)', async () => {
      jest.spyOn(refreshTokenModel, 'findOne').mockResolvedValue(null);

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken('invalid-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should detect token reuse and revoke entire family', async () => {
      const revokedTokenDoc = {
        ...mockRefreshTokenDoc,
        token: revokedRefreshToken,
        isRevoked: true,
        family: 'compromised-family-uuid',
      };

      jest.spyOn(refreshTokenModel, 'findOne')
        .mockResolvedValueOnce(null) // First call: not found as active token
        .mockResolvedValueOnce(revokedTokenDoc as any); // Second call: found as revoked token

      jest.spyOn(refreshTokenModel, 'updateMany').mockResolvedValue({ modifiedCount: 3 } as any);

      // Call once - it should detect reuse and revoke family
      try {
        await service.refreshToken(revokedRefreshToken);
        fail('Should have thrown UnauthorizedException');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toContain('Token reuse detected');
      }

      expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
        { family: 'compromised-family-uuid', isRevoked: false },
        { isRevoked: true, revokedAt: expect.any(Date) }
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const tokenDoc = {
        ...mockRefreshTokenDoc,
        token: validRefreshToken,
        isRevoked: false,
        save: jest.fn(),
      };

      jest.spyOn(refreshTokenModel, 'findOne').mockResolvedValue(tokenDoc as any);
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow('User not found');
    });

    it('should handle token metadata in refresh', async () => {
      const tokenDoc = {
        ...mockRefreshTokenDoc,
        token: validRefreshToken,
        isRevoked: false,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(refreshTokenModel, 'findOne').mockResolvedValue(tokenDoc as any);

      const metadata = {
        ipAddress: '192.168.1.100',
        userAgent: 'Safari',
        deviceId: 'safari-device',
      };

      await service.refreshToken(validRefreshToken, metadata);

      const createCall = (refreshTokenModel.create as jest.Mock).mock.calls[0][0];
      expect(createCall.metadata).toEqual(metadata);
    });
  });

  describe('revokeUserTokens', () => {
    it('should revoke all active tokens for user', async () => {
      jest.spyOn(refreshTokenModel, 'updateMany').mockResolvedValue({ modifiedCount: 5 } as any);

      await service.revokeUserTokens(mockUserId.toString());

      expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
        { userId: mockUserId, isRevoked: false },
        { isRevoked: true, revokedAt: expect.any(Date) }
      );
    });

    it('should handle user with no active tokens', async () => {
      jest.spyOn(refreshTokenModel, 'updateMany').mockResolvedValue({ modifiedCount: 0 } as any);

      await expect(service.revokeUserTokens(mockUserId.toString())).resolves.not.toThrow();

      expect(refreshTokenModel.updateMany).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      jest.spyOn(refreshTokenModel, 'deleteMany').mockResolvedValue({ deletedCount: 42 } as any);

      await service.cleanupExpiredTokens();

      expect(refreshTokenModel.deleteMany).toHaveBeenCalledWith({
        expiresAt: { $lt: expect.any(Date) },
      });
    });

    it('should handle when no expired tokens exist', async () => {
      jest.spyOn(refreshTokenModel, 'deleteMany').mockResolvedValue({ deletedCount: 0 } as any);

      await expect(service.cleanupExpiredTokens()).resolves.not.toThrow();

      expect(refreshTokenModel.deleteMany).toHaveBeenCalled();
    });

    it('should log deleted count', async () => {
      jest.spyOn(refreshTokenModel, 'deleteMany').mockResolvedValue({ deletedCount: 10 } as any);
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      await service.cleanupExpiredTokens();

      expect(loggerSpy).toHaveBeenCalledWith('Cleaned up 10 expired refresh tokens');
    });
  });

  describe('validateToken', () => {
    it('should return valid: true for valid token', async () => {
      const mockDecoded = {
        sub: mockUserId,
        email: mockUser.email,
        phone: mockUser.phone,
        role: mockUser.role,
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(mockDecoded);

      const result = await service.validateToken(mockAccessToken);

      expect(result).toEqual({
        valid: true,
        user: mockDecoded,
      });

      expect(jwtService.verify).toHaveBeenCalledWith(mockAccessToken);
    });

    it('should return valid: false for expired token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = await service.validateToken('expired-token');

      expect(result).toEqual({
        valid: false,
        error: 'Token expired',
      });
    });

    it('should return valid: false for malformed token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token format');
      });

      const result = await service.validateToken('malformed-token');

      expect(result).toEqual({
        valid: false,
        error: 'Invalid token format',
      });
    });
  });

  describe('Token Configuration', () => {
    it('should use correct access token expiry', () => {
      expect(TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY).toBe('15m');
      expect(TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS).toBe(900);
    });

    it('should use correct refresh token expiry', () => {
      expect(TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS).toBe(30);
      expect(TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_SECONDS).toBe(30 * 24 * 60 * 60);
    });

    it('should have auto-refresh threshold configured', () => {
      expect(TOKEN_CONFIG.AUTO_REFRESH_THRESHOLD_SECONDS).toBe(300);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      jest.spyOn(refreshTokenModel, 'create').mockRejectedValue(new Error('Database connection failed'));

      await expect(service.login(mockUser)).rejects.toThrow('Database connection failed');
    });

    it('should handle user service errors', async () => {
      jest.spyOn(usersService, 'findByEmail').mockRejectedValue(new Error('User service unavailable'));
      const loginDto: LoginDto = { email: 'test@example.com', password: 'password' };

      await expect(service.validateUser(loginDto)).rejects.toThrow('User service unavailable');
    });

    it('should handle JWT signing errors', async () => {
      jest.spyOn(jwtService, 'sign').mockImplementation(() => {
        throw new Error('JWT signing failed');
      });
      jest.spyOn(refreshTokenModel, 'create').mockResolvedValue({} as any);

      await expect(service.login(mockUser)).rejects.toThrow('JWT signing failed');
    });
  });

  describe('Security Features', () => {
    it('should not expose password in login response', async () => {
      jest.spyOn(refreshTokenModel, 'create').mockResolvedValue(mockRefreshTokenDoc as any);

      const result = await service.login(mockUser);

      expect(result.user).not.toHaveProperty('password');
    });

    it('should not expose password in register response', async () => {
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser as any);
      jest.spyOn(refreshTokenModel, 'create').mockResolvedValue(mockRefreshTokenDoc as any);

      const createUserDto: CreateUserDto = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
        phone: '9876543210',
        role: 'user',
      };

      const result = await service.register(createUserDto);

      expect(result.user).not.toHaveProperty('password');
    });

    it('should log security warnings for token reuse', async () => {
      const revokedTokenDoc = {
        ...mockRefreshTokenDoc,
        token: 'reused-token',
        isRevoked: true,
        family: 'test-family',
      };

      jest.spyOn(refreshTokenModel, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(revokedTokenDoc as any);
      jest.spyOn(refreshTokenModel, 'updateMany').mockResolvedValue({ modifiedCount: 1 } as any);

      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      await expect(service.refreshToken('reused-token')).rejects.toThrow(UnauthorizedException);

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Token reuse detected'));
    });
  });
});
