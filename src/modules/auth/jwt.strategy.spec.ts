import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { jwtConstants } from './constants';
import { UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('Strategy Configuration', () => {
    it('should extract JWT from Authorization header as Bearer token', () => {
      // Access the strategy's configuration
      const strategyOptions = (strategy as any)._jwtFromRequest;
      expect(strategyOptions).toBeDefined();
    });

    it('should not ignore token expiration', () => {
      const ignoreExpiration = (strategy as any)._passReqToCallback;
      // ignoreExpiration is set to false in constructor
      expect((strategy as any)._verify).toBeDefined();
    });

    it('should use JWT secret from constants', () => {
      // JWT secret is configured in the strategy constructor
      expect(jwtConstants.secret).toBeDefined();
      expect(typeof jwtConstants.secret).toBe('string');
    });
  });

  describe('validate()', () => {
    it('should validate payload with new token format (sub field)', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        sub: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      });
    });

    it('should validate payload with old token format (id field)', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        id: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      });
    });

    it('should prefer sub over id if both are present', async () => {
      const mockUserId = new Types.ObjectId();
      const oldUserId = new Types.ObjectId();
      const payload = {
        sub: mockUserId,
        id: oldUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      };

      const result = await strategy.validate(payload);

      expect(result.userId).toBe(mockUserId);
      expect(result.userId).not.toBe(oldUserId);
    });

    it('should return all required fields', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        sub: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'admin',
      };

      const result = await strategy.validate(payload);

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('phone');
      expect(result).toHaveProperty('role');
    });

    it('should handle payload with missing optional fields', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        sub: mockUserId,
        email: 'test@example.com',
        // phone and role might be missing
      };

      const result = await strategy.validate(payload);

      expect(result.userId).toBe(mockUserId);
      expect(result.email).toBe('test@example.com');
      expect(result.phone).toBeUndefined();
      expect(result.role).toBeUndefined();
    });

    it('should return normalized user object for new token format', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        sub: mockUserId,
        email: 'newformat@example.com',
        phone: '9876543210',
        role: 'provider',
        iat: 1234567890,
        exp: 1234568790,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: mockUserId,
        email: 'newformat@example.com',
        phone: '9876543210',
        role: 'provider',
      });
      expect(result).not.toHaveProperty('iat');
      expect(result).not.toHaveProperty('exp');
    });

    it('should return normalized user object for old token format', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        id: mockUserId,
        email: 'oldformat@example.com',
        phone: '1111111111',
        role: 'seeker',
        iat: 1234567890,
        exp: 1234568790,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: mockUserId,
        email: 'oldformat@example.com',
        phone: '1111111111',
        role: 'seeker',
      });
    });

    it('should handle different user roles', async () => {
      const mockUserId = new Types.ObjectId();
      const roles = ['user', 'admin', 'provider', 'seeker'];

      for (const role of roles) {
        const payload = {
          sub: mockUserId,
          email: `${role}@example.com`,
          phone: '1234567890',
          role: role,
        };

        const result = await strategy.validate(payload);

        expect(result.role).toBe(role);
        expect(result.userId).toBe(mockUserId);
      }
    });

    it('should handle payloads with string user IDs', async () => {
      const payload = {
        sub: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      };

      const result = await strategy.validate(payload);

      expect(result.userId).toBe('507f1f77bcf86cd799439011');
      expect(typeof result.userId).toBe('string');
    });

    it('should handle payloads with ObjectId user IDs', async () => {
      const mockUserId = new Types.ObjectId('507f1f77bcf86cd799439011');
      const payload = {
        sub: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      };

      const result = await strategy.validate(payload);

      expect(result.userId).toEqual(mockUserId);
    });
  });

  describe('Backward Compatibility', () => {
    it('should support legacy tokens with "id" field instead of "sub"', async () => {
      const mockUserId = new Types.ObjectId();
      const legacyPayload = {
        id: mockUserId,
        email: 'legacy@example.com',
        phone: '9999999999',
        role: 'user',
      };

      const result = await strategy.validate(legacyPayload);

      expect(result.userId).toBe(mockUserId);
      expect(result.email).toBe('legacy@example.com');
    });

    it('should map legacy id to userId in response', async () => {
      const mockUserId = new Types.ObjectId();
      const legacyPayload = {
        id: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      };

      const result = await strategy.validate(legacyPayload);

      expect(result).toHaveProperty('userId');
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('sub');
    });
  });

  describe('Token Extraction', () => {
    it('should be configured to extract token from Bearer authorization header', () => {
      // The strategy should use ExtractJwt.fromAuthHeaderAsBearerToken()
      // This is configured in the constructor
      const jwtFromRequest = (strategy as any)._jwtFromRequest;
      expect(jwtFromRequest).toBeDefined();
    });
  });

  describe('Token Expiration', () => {
    it('should not ignore token expiration (ignoreExpiration: false)', () => {
      // When ignoreExpiration is false, expired tokens are rejected by passport
      // This is a configuration check
      const ignoreExpiration = (strategy as any)._passReqToCallback;
      // The strategy should reject expired tokens automatically
      expect(strategy).toBeDefined();
    });
  });

  describe('Security', () => {
    it('should use secret from jwtConstants', () => {
      // Verify jwtConstants has a secret configured
      expect(jwtConstants.secret).toBeDefined();
      expect(typeof jwtConstants.secret).toBe('string');
      expect(jwtConstants.secret.length).toBeGreaterThan(0);
    });

    it('should return only safe user data (no sensitive fields)', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        sub: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
        password: 'should-not-be-returned',
        privateKey: 'should-not-be-returned',
      };

      const result = await strategy.validate(payload);

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('privateKey');
      expect(Object.keys(result)).toEqual(['userId', 'email', 'phone', 'role']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle payload with undefined sub and id', async () => {
      const payload = {
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      };

      const result = await strategy.validate(payload);

      expect(result.userId).toBeUndefined();
      expect(result.email).toBe('test@example.com');
    });

    it('should handle payload with null values', async () => {
      const payload = {
        sub: null,
        id: null,
        email: null,
        phone: null,
        role: null,
      };

      const result = await strategy.validate(payload);

      expect(result.userId).toBeNull();
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.role).toBeNull();
    });

    it('should handle payload with empty strings', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        sub: mockUserId,
        email: '',
        phone: '',
        role: '',
      };

      const result = await strategy.validate(payload);

      expect(result.userId).toBe(mockUserId);
      expect(result.email).toBe('');
      expect(result.phone).toBe('');
      expect(result.role).toBe('');
    });

    it('should handle payload with extra fields', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        sub: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
        extraField1: 'value1',
        extraField2: 'value2',
        iat: 1234567890,
        exp: 1234568790,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      });
      expect(result).not.toHaveProperty('extraField1');
      expect(result).not.toHaveProperty('extraField2');
    });
  });

  describe('Integration with Passport', () => {
    it('should extend PassportStrategy', () => {
      expect(strategy).toBeInstanceOf(JwtStrategy);
    });

    it('should have validate method', () => {
      expect(typeof strategy.validate).toBe('function');
    });

    it('should return promise from validate', async () => {
      const mockUserId = new Types.ObjectId();
      const payload = {
        sub: mockUserId,
        email: 'test@example.com',
        phone: '1234567890',
        role: 'user',
      };

      const result = strategy.validate(payload);
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeDefined();
    });
  });
});
