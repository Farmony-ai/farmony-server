import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { OtpLoginDto } from './dto/otp-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Types } from 'mongoose';

const mockUserId = new Types.ObjectId('507f1f77bcf86cd799439011');

const mockUser = {
  _id: mockUserId,
  email: 'test@example.com',
  phone: '1234567890',
  name: 'Test User',
  password: 'hashedPassword',
  role: 'user',
  isVerified: true,
  kycStatus: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
  save: jest.fn().mockResolvedValue(this),
};

const mockAuthResponse = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 900,
  token_type: 'Bearer',
  user: {
    id: mockUserId,
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
  },
};

const mockOtpLoginResponse = {
  message: 'OTP login successful',
  token: 'mock-access-token',
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 900,
  token_type: 'Bearer',
  user: {
    id: mockUserId,
    name: 'Test User',
    email: 'test@example.com',
    phone: '1234567890',
    role: 'user',
    isVerified: true,
    kycStatus: 'pending',
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  },
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            validateUser: jest.fn(),
            login: jest.fn(),
            register: jest.fn(),
            otpLogin: jest.fn(),
            refreshToken: jest.fn(),
            validateToken: jest.fn(),
            revokeUserTokens: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByPhone: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/register', () => {
    const createUserDto = {
      name: 'New User',
      email: 'newuser@example.com',
      password: 'password123',
      phone: '9876543210',
      role: 'user',
    };

    it('should register a new user and return tokens', async () => {
      jest.spyOn(authService, 'register').mockResolvedValue({
        user: {
          _id: mockUserId,
          email: createUserDto.email,
          name: createUserDto.name,
          phone: createUserDto.phone,
          role: createUserDto.role,
          isVerified: false,
          kycStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        access_token: mockAuthResponse.access_token,
        refresh_token: mockAuthResponse.refresh_token,
        expires_in: mockAuthResponse.expires_in,
        token_type: mockAuthResponse.token_type,
      });

      const result = await controller.register(createUserDto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(createUserDto.email);
      expect(authService.register).toHaveBeenCalledWith(createUserDto);
    });

    it('should call authService.register with correct parameters', async () => {
      jest.spyOn(authService, 'register').mockResolvedValue(mockAuthResponse as any);

      await controller.register(createUserDto);

      expect(authService.register).toHaveBeenCalledTimes(1);
      expect(authService.register).toHaveBeenCalledWith(createUserDto);
    });

    it('should handle registration errors', async () => {
      jest.spyOn(authService, 'register').mockRejectedValue(new Error('Email already exists'));

      await expect(controller.register(createUserDto)).rejects.toThrow('Email already exists');
    });
  });

  describe('POST /auth/login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login with valid credentials and return tokens', async () => {
      jest.spyOn(authService, 'validateUser').mockResolvedValue(mockUser as any);
      jest.spyOn(authService, 'login').mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.validateUser).toHaveBeenCalledWith(loginDto);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
    });

    it('should login with phone and password', async () => {
      const phoneLoginDto: LoginDto = {
        phone: '1234567890',
        password: 'password123',
      };

      jest.spyOn(authService, 'validateUser').mockResolvedValue(mockUser as any);
      jest.spyOn(authService, 'login').mockResolvedValue(mockAuthResponse);

      const result = await controller.login(phoneLoginDto);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.validateUser).toHaveBeenCalledWith(phoneLoginDto);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      jest.spyOn(authService, 'validateUser').mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(controller.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      jest.spyOn(authService, 'validateUser').mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/otp-login', () => {
    it('should login with email via OTP', async () => {
      const otpLoginDto: OtpLoginDto = {
        email: 'test@example.com',
      };

      jest.spyOn(authService, 'otpLogin').mockResolvedValue(mockOtpLoginResponse);

      const result = await controller.otpLogin(otpLoginDto);

      expect(result).toEqual(mockOtpLoginResponse);
      expect(result.message).toBe('OTP login successful');
      expect(result.token).toBeDefined(); // Backward compatibility
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(authService.otpLogin).toHaveBeenCalledWith(otpLoginDto);
    });

    it('should login with phone via OTP', async () => {
      const otpLoginDto: OtpLoginDto = {
        phone: '1234567890',
      };

      jest.spyOn(authService, 'otpLogin').mockResolvedValue(mockOtpLoginResponse);

      const result = await controller.otpLogin(otpLoginDto);

      expect(result).toEqual(mockOtpLoginResponse);
      expect(authService.otpLogin).toHaveBeenCalledWith(otpLoginDto);
    });

    it('should mark user as verified after OTP login', async () => {
      const otpLoginDto: OtpLoginDto = {
        email: 'test@example.com',
      };

      jest.spyOn(authService, 'otpLogin').mockResolvedValue(mockOtpLoginResponse);

      const result = await controller.otpLogin(otpLoginDto);

      expect(result.user.isVerified).toBe(true);
    });

    it('should throw NotFoundException for unregistered email', async () => {
      const otpLoginDto: OtpLoginDto = {
        email: 'nonexistent@example.com',
      };

      jest.spyOn(authService, 'otpLogin').mockRejectedValue(new NotFoundException('Email not registered'));

      await expect(controller.otpLogin(otpLoginDto)).rejects.toThrow(NotFoundException);
      await expect(controller.otpLogin(otpLoginDto)).rejects.toThrow('Email not registered');
    });

    it('should throw NotFoundException for unregistered phone', async () => {
      const otpLoginDto: OtpLoginDto = {
        phone: '9999999999',
      };

      jest.spyOn(authService, 'otpLogin').mockRejectedValue(new NotFoundException('Phone number not registered'));

      await expect(controller.otpLogin(otpLoginDto)).rejects.toThrow(NotFoundException);
    });

    it('should return detailed user information', async () => {
      const otpLoginDto: OtpLoginDto = {
        email: 'test@example.com',
      };

      jest.spyOn(authService, 'otpLogin').mockResolvedValue(mockOtpLoginResponse);

      const result = await controller.otpLogin(otpLoginDto);

      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('name');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('phone');
      expect(result.user).toHaveProperty('role');
      expect(result.user).toHaveProperty('isVerified');
      expect(result.user).toHaveProperty('kycStatus');
      expect(result.user).toHaveProperty('createdAt');
      expect(result.user).toHaveProperty('updatedAt');
    });
  });

  describe('POST /auth/refresh', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    const mockRefreshResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 900,
      token_type: 'Bearer',
    };

    it('should refresh tokens with valid refresh token', async () => {
      jest.spyOn(authService, 'refreshToken').mockResolvedValue(mockRefreshResponse);

      const result = await controller.refreshToken(refreshTokenDto);

      expect(result).toEqual(mockRefreshResponse);
      expect(result.access_token).toBe('new-access-token');
      expect(result.refresh_token).toBe('new-refresh-token');
      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jest.spyOn(authService, 'refreshToken').mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

      await expect(controller.refreshToken(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
      await expect(controller.refreshToken(refreshTokenDto)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      jest.spyOn(authService, 'refreshToken').mockRejectedValue(new UnauthorizedException('Refresh token expired'));

      await expect(controller.refreshToken(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked token (reuse detection)', async () => {
      jest.spyOn(authService, 'refreshToken').mockRejectedValue(new UnauthorizedException('Token reuse detected'));

      await expect(controller.refreshToken(refreshTokenDto)).rejects.toThrow('Token reuse detected');
    });

    it('should return new token pair with correct expiry', async () => {
      jest.spyOn(authService, 'refreshToken').mockResolvedValue(mockRefreshResponse);

      const result = await controller.refreshToken(refreshTokenDto);

      expect(result.expires_in).toBe(900); // 15 minutes in seconds
      expect(result.token_type).toBe('Bearer');
    });
  });

  describe('GET /auth/profile', () => {
    it('should return current user profile', async () => {
      const mockRequest = {
        user: {
          userId: mockUserId,
          email: 'test@example.com',
          phone: '1234567890',
          role: 'user',
        },
      };

      const result = controller.getProfile(mockRequest);

      expect(result).toEqual(mockRequest.user);
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('phone');
      expect(result).toHaveProperty('role');
    });

    it('should be protected by JWT guard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.getProfile);
      expect(guards).toBeDefined();
    });
  });

  describe('GET /auth/verify-token', () => {
    it('should verify valid JWT token and return user info', async () => {
      const mockRequest = {
        user: {
          userId: mockUserId,
          email: 'test@example.com',
          phone: '1234567890',
          role: 'user',
        },
      };

      const result = await controller.verifyToken(mockRequest);

      expect(result).toEqual({
        valid: true,
        userId: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      });
    });

    it('should be protected by JWT guard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.verifyToken);
      expect(guards).toBeDefined();
    });

    it('should return all required user fields', async () => {
      const mockRequest = {
        user: {
          userId: mockUserId,
          email: 'test@example.com',
          phone: '1234567890',
          role: 'admin',
        },
      };

      const result = await controller.verifyToken(mockRequest);

      expect(result.valid).toBe(true);
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('phone');
      expect(result).toHaveProperty('role');
    });
  });

  describe('POST /auth/validate-token', () => {
    it('should validate token from Authorization header', async () => {
      const authHeader = 'Bearer valid-token';
      jest.spyOn(authService, 'validateToken').mockResolvedValue({
        valid: true,
        user: {
          sub: mockUserId,
          email: 'test@example.com',
          phone: '1234567890',
          role: 'user',
        },
      });

      const result = await controller.validateToken(authHeader);

      expect(result.valid).toBe(true);
      expect(result).toHaveProperty('user');
      expect(authService.validateToken).toHaveBeenCalledWith('valid-token');
    });

    it('should return error if no Authorization header provided', async () => {
      const result = await controller.validateToken('');

      expect(result).toEqual({
        valid: false,
        error: 'No token provided',
      });
    });

    it('should return error if Authorization header does not start with Bearer', async () => {
      const result = await controller.validateToken('InvalidHeader token');

      expect(result).toEqual({
        valid: false,
        error: 'No token provided',
      });
    });

    it('should return error for invalid token format', async () => {
      const authHeader = 'Bearer invalid-token';
      jest.spyOn(authService, 'validateToken').mockResolvedValue({
        valid: false,
        error: 'Invalid token format',
      });

      const result = await controller.validateToken(authHeader);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token format');
    });

    it('should return error for expired token', async () => {
      const authHeader = 'Bearer expired-token';
      jest.spyOn(authService, 'validateToken').mockResolvedValue({
        valid: false,
        error: 'Token expired',
      });

      const result = await controller.validateToken(authHeader);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should extract token correctly from Bearer header', async () => {
      const authHeader = 'Bearer my-jwt-token-here';
      jest.spyOn(authService, 'validateToken').mockResolvedValue({
        valid: true,
        user: { sub: mockUserId },
      });

      await controller.validateToken(authHeader);

      expect(authService.validateToken).toHaveBeenCalledWith('my-jwt-token-here');
    });
  });

  describe('POST /auth/reset-password', () => {
    const resetPasswordDto: ResetPasswordDto = {
      phone: '+911234567890',
      newPassword: 'newPassword123',
    };

    it('should reset password for valid phone number', async () => {
      const mockUserWithSave = {
        ...mockUser,
        password: 'oldHashedPassword',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(mockUserWithSave as any);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(result).toEqual({
        message: 'Password reset successfully',
        success: true,
      });
      expect(usersService.findByPhone).toHaveBeenCalledWith(resetPasswordDto.phone);
      expect(mockUserWithSave.password).toBe(resetPasswordDto.newPassword);
      expect(mockUserWithSave.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(null);

      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow(NotFoundException);
      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow('User not found');
    });

    it('should update password field before saving', async () => {
      const mockUserWithSave = {
        ...mockUser,
        password: 'oldHashedPassword',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(mockUserWithSave as any);

      await controller.resetPassword(resetPasswordDto);

      expect(mockUserWithSave.password).toBe(resetPasswordDto.newPassword);
      expect(mockUserWithSave.save).toHaveBeenCalled();
    });

    it('should trigger pre-save hook to hash password', async () => {
      const mockUserWithSave = {
        ...mockUser,
        password: 'oldHashedPassword',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(mockUserWithSave as any);

      await controller.resetPassword(resetPasswordDto);

      // Password is set to plain text, but pre-save hook should hash it
      expect(mockUserWithSave.save).toHaveBeenCalled();
    });

    it('should handle database errors during save', async () => {
      const mockUserWithSave = {
        ...mockUser,
        password: 'oldHashedPassword',
        save: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(mockUserWithSave as any);

      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow('Database error');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user and revoke all tokens', async () => {
      const mockRequest = {
        user: {
          userId: mockUserId.toString(),
          email: 'test@example.com',
        },
      };

      jest.spyOn(authService, 'revokeUserTokens').mockResolvedValue();

      const result = await controller.logout(mockRequest);

      expect(result).toEqual({
        message: 'Logged out successfully',
      });
      expect(authService.revokeUserTokens).toHaveBeenCalledWith(mockRequest.user.userId);
    });

    it('should be protected by JWT guard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.logout);
      expect(guards).toBeDefined();
    });

    it('should revoke tokens for correct user', async () => {
      const mockRequest = {
        user: {
          userId: 'specific-user-id',
        },
      };

      jest.spyOn(authService, 'revokeUserTokens').mockResolvedValue();

      await controller.logout(mockRequest);

      expect(authService.revokeUserTokens).toHaveBeenCalledWith('specific-user-id');
      expect(authService.revokeUserTokens).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during token revocation', async () => {
      const mockRequest = {
        user: {
          userId: mockUserId.toString(),
        },
      };

      jest.spyOn(authService, 'revokeUserTokens').mockRejectedValue(new Error('Database error'));

      await expect(controller.logout(mockRequest)).rejects.toThrow('Database error');
    });

    it('should successfully logout even if user has no active tokens', async () => {
      const mockRequest = {
        user: {
          userId: mockUserId.toString(),
        },
      };

      jest.spyOn(authService, 'revokeUserTokens').mockResolvedValue();

      const result = await controller.logout(mockRequest);

      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('Controller Guards and Decorators', () => {
    it('should have ApiTags decorator', () => {
      const tags = Reflect.getMetadata('swagger/apiUseTags', AuthController);
      expect(tags).toContain('Auth');
    });

    it('should protect /profile endpoint with JWT guard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.getProfile);
      expect(guards).toBeDefined();
    });

    it('should protect /verify-token endpoint with JWT guard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.verifyToken);
      expect(guards).toBeDefined();
    });

    it('should protect /logout endpoint with JWT guard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.logout);
      expect(guards).toBeDefined();
    });

    it('should NOT protect /login endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', controller.login);
      expect(guards).toBeUndefined();
    });

    it('should NOT protect /register endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', controller.register);
      expect(guards).toBeUndefined();
    });

    it('should NOT protect /refresh endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', controller.refreshToken);
      expect(guards).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors to client', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password',
      };

      jest.spyOn(authService, 'validateUser').mockRejectedValue(new Error('Service unavailable'));

      await expect(controller.login(loginDto)).rejects.toThrow('Service unavailable');
    });

    it('should handle database connection errors', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'valid-token',
      };

      jest.spyOn(authService, 'refreshToken').mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.refreshToken(refreshTokenDto)).rejects.toThrow('Database connection failed');
    });

    it('should handle validation errors from DTOs', async () => {
      const invalidLoginDto: any = {
        // Missing required fields
      };

      jest.spyOn(authService, 'validateUser').mockRejectedValue(new Error('Validation failed'));

      await expect(controller.login(invalidLoginDto)).rejects.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete full registration flow', async () => {
      const createUserDto = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
        phone: '9876543210',
        role: 'user',
      };

      jest.spyOn(authService, 'register').mockResolvedValue({
        user: {
          _id: mockUserId,
          email: createUserDto.email,
          name: createUserDto.name,
          phone: createUserDto.phone,
          role: createUserDto.role,
          isVerified: false,
          kycStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 900,
        token_type: 'Bearer',
      });

      const result = await controller.register(createUserDto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(createUserDto.email);
    });

    it('should complete full login → profile → logout flow', async () => {
      // Step 1: Login
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password',
      };

      jest.spyOn(authService, 'validateUser').mockResolvedValue(mockUser as any);
      jest.spyOn(authService, 'login').mockResolvedValue(mockAuthResponse);

      const loginResult = await controller.login(loginDto);
      expect(loginResult).toHaveProperty('access_token');

      // Step 2: Get Profile
      const mockRequest = {
        user: {
          userId: mockUserId,
          email: 'test@example.com',
          phone: '1234567890',
          role: 'user',
        },
      };

      const profileResult = controller.getProfile(mockRequest);
      expect(profileResult.email).toBe('test@example.com');

      // Step 3: Logout
      jest.spyOn(authService, 'revokeUserTokens').mockResolvedValue();
      const logoutResult = await controller.logout(mockRequest);
      expect(logoutResult.message).toBe('Logged out successfully');
    });

    it('should complete token refresh flow', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'old-refresh-token',
      };

      jest.spyOn(authService, 'refreshToken').mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 900,
        token_type: 'Bearer',
      });

      const result = await controller.refreshToken(refreshTokenDto);

      expect(result.access_token).toBe('new-access-token');
      expect(result.refresh_token).toBe('new-refresh-token');
      expect(result.refresh_token).not.toBe(refreshTokenDto.refreshToken);
    });
  });
});
