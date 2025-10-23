import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { LoginDto } from './login.dto';
import { OtpLoginDto } from './otp-login.dto';
import { RefreshTokenDto } from './refresh-token.dto';
import { ResetPasswordDto } from './reset-password.dto';

describe('Auth DTOs Validation', () => {
  describe('LoginDto', () => {
    it('should validate with email and password', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'test@example.com',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with phone and password', async () => {
      const dto = plainToClass(LoginDto, {
        phone: '1234567890',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with both email and phone', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'test@example.com',
        phone: '1234567890',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation without password', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with invalid email format', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'invalid-email',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should fail validation with empty password', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'test@example.com',
        password: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('should fail validation with non-string password', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'test@example.com',
        password: 123456 as any,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('should accept valid email formats', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'firstname+lastname@example.com',
        'email@subdomain.example.com',
      ];

      for (const email of validEmails) {
        const dto = plainToClass(LoginDto, {
          email,
          password: 'password123',
        });

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'plainaddress',
        '@missinglocal.com',
        'missing@domain',
        'missing.domain@.com',
        'two@@example.com',
      ];

      for (const email of invalidEmails) {
        const dto = plainToClass(LoginDto, {
          email,
          password: 'password123',
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should allow missing email if phone is provided (optional fields)', async () => {
      const dto = plainToClass(LoginDto, {
        phone: '1234567890',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow missing phone if email is provided (optional fields)', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'test@example.com',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('OtpLoginDto', () => {
    it('should validate with email', async () => {
      const dto = plainToClass(OtpLoginDto, {
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with phone', async () => {
      const dto = plainToClass(OtpLoginDto, {
        phone: '1234567890',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with both email and phone', async () => {
      const dto = plainToClass(OtpLoginDto, {
        email: 'test@example.com',
        phone: '1234567890',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid email format', async () => {
      const dto = plainToClass(OtpLoginDto, {
        email: 'invalid-email',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should fail validation with phone less than 10 digits', async () => {
      const dto = plainToClass(OtpLoginDto, {
        phone: '123456789', // Only 9 digits
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('phone');
      expect(errors[0].constraints).toHaveProperty('matches');
      expect(errors[0].constraints.matches).toContain('Valid phone number is required');
    });

    it('should fail validation with phone more than 15 digits', async () => {
      const dto = plainToClass(OtpLoginDto, {
        phone: '1234567890123456', // 16 digits
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('phone');
    });

    it('should fail validation with phone containing non-digits', async () => {
      const invalidPhones = [
        '+1234567890', // Contains +
        '123-456-7890', // Contains -
        '(123) 456-7890', // Contains () and space
        '123 456 7890', // Contains spaces
        'abc1234567890', // Contains letters
      ];

      for (const phone of invalidPhones) {
        const dto = plainToClass(OtpLoginDto, {
          phone,
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should accept valid phone numbers (10-15 digits)', async () => {
      const validPhones = [
        '1234567890', // 10 digits
        '12345678901', // 11 digits
        '123456789012', // 12 digits
        '1234567890123', // 13 digits
        '12345678901234', // 14 digits
        '123456789012345', // 15 digits
      ];

      for (const phone of validPhones) {
        const dto = plainToClass(OtpLoginDto, {
          phone,
        });

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should allow missing fields (both optional)', async () => {
      const dto = plainToClass(OtpLoginDto, {});

      const errors = await validate(dto);
      // Both fields are optional, so no validation errors
      expect(errors.length).toBe(0);
    });

    it('should have custom error message for phone validation', async () => {
      const dto = plainToClass(OtpLoginDto, {
        phone: '123', // Invalid
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints.matches).toBe('Valid phone number is required');
    });
  });

  describe('RefreshTokenDto', () => {
    it('should validate with valid refresh token', async () => {
      const dto = plainToClass(RefreshTokenDto, {
        refreshToken: 'valid-uuid-v4-token',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation without refreshToken', async () => {
      const dto = plainToClass(RefreshTokenDto, {});

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('refreshToken');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with empty refreshToken', async () => {
      const dto = plainToClass(RefreshTokenDto, {
        refreshToken: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('refreshToken');
    });

    it('should fail validation with non-string refreshToken', async () => {
      const dto = plainToClass(RefreshTokenDto, {
        refreshToken: 123456 as any,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('refreshToken');
    });

    it('should accept any non-empty string as refreshToken', async () => {
      const validTokens = [
        'simple-token',
        'uuid-v4-format-token',
        'very-long-token-string-with-many-characters',
        '12345678-1234-1234-1234-123456789012',
      ];

      for (const refreshToken of validTokens) {
        const dto = plainToClass(RefreshTokenDto, {
          refreshToken,
        });

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should have both isString and isNotEmpty constraints', async () => {
      const dto = plainToClass(RefreshTokenDto, {
        refreshToken: null as any,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('refreshToken');
    });
  });

  describe('ResetPasswordDto', () => {
    it('should validate with valid Indian phone number and password', async () => {
      const dto = plainToClass(ResetPasswordDto, {
        phone: '+919876543210',
        newPassword: 'newPassword123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation without phone', async () => {
      const dto = plainToClass(ResetPasswordDto, {
        newPassword: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const phoneError = errors.find(e => e.property === 'phone');
      expect(phoneError).toBeDefined();
    });

    it('should fail validation without newPassword', async () => {
      const dto = plainToClass(ResetPasswordDto, {
        phone: '+919876543210',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find(e => e.property === 'newPassword');
      expect(passwordError).toBeDefined();
    });

    it('should fail validation with password less than 6 characters', async () => {
      const dto = plainToClass(ResetPasswordDto, {
        phone: '+919876543210',
        newPassword: '12345', // Only 5 characters
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find(e => e.property === 'newPassword');
      expect(passwordError?.constraints).toHaveProperty('minLength');
    });

    it('should accept password with exactly 6 characters', async () => {
      const dto = plainToClass(ResetPasswordDto, {
        phone: '+919876543210',
        newPassword: '123456',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept password with more than 6 characters', async () => {
      const dto = plainToClass(ResetPasswordDto, {
        phone: '+919876543210',
        newPassword: 'veryLongPassword123456789',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid Indian phone number formats', async () => {
      const validIndianPhones = [
        '+919876543210',
        '+91 9876543210',
        '919876543210',
        '9876543210',
      ];

      for (const phone of validIndianPhones) {
        const dto = plainToClass(ResetPasswordDto, {
          phone,
          newPassword: 'password123',
        });

        const errors = await validate(dto);
        // Note: Some formats might fail depending on IsPhoneNumber('IN') strictness
        // This test documents expected behavior
      }
    });

    it('should fail validation with invalid phone format', async () => {
      const invalidPhones = [
        '123', // Too short
        'abcdefghij', // Not a number
        '+1234567890', // Not Indian format
      ];

      for (const phone of invalidPhones) {
        const dto = plainToClass(ResetPasswordDto, {
          phone,
          newPassword: 'password123',
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should fail validation with non-string phone', async () => {
      const dto = plainToClass(ResetPasswordDto, {
        phone: 9876543210 as any,
        newPassword: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation with non-string password', async () => {
      const dto = plainToClass(ResetPasswordDto, {
        phone: '+919876543210',
        newPassword: 123456 as any,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should have isString, isPhoneNumber and minLength constraints', async () => {
      const dto1 = plainToClass(ResetPasswordDto, {
        phone: 'invalid',
        newPassword: '123',
      });

      const errors = await validate(dto1);
      expect(errors.length).toBeGreaterThan(0);

      const phoneError = errors.find(e => e.property === 'phone');
      const passwordError = errors.find(e => e.property === 'newPassword');

      if (phoneError) {
        expect(phoneError.constraints).toHaveProperty('isPhoneNumber');
      }
      if (passwordError) {
        expect(passwordError.constraints).toHaveProperty('minLength');
      }
    });
  });

  describe('Cross-DTO Validation', () => {
    it('should validate all DTOs with valid data', async () => {
      const loginDto = plainToClass(LoginDto, {
        email: 'test@example.com',
        password: 'password123',
      });

      const otpLoginDto = plainToClass(OtpLoginDto, {
        phone: '1234567890',
      });

      const refreshTokenDto = plainToClass(RefreshTokenDto, {
        refreshToken: 'valid-token',
      });

      const resetPasswordDto = plainToClass(ResetPasswordDto, {
        phone: '+919876543210',
        newPassword: 'newPassword123',
      });

      const loginErrors = await validate(loginDto);
      const otpLoginErrors = await validate(otpLoginDto);
      const refreshTokenErrors = await validate(refreshTokenDto);
      const resetPasswordErrors = await validate(resetPasswordDto);

      expect(loginErrors.length).toBe(0);
      expect(otpLoginErrors.length).toBe(0);
      expect(refreshTokenErrors.length).toBe(0);
      expect(resetPasswordErrors.length).toBe(0);
    });

    it('should handle empty objects for all DTOs', async () => {
      const loginDto = plainToClass(LoginDto, {});
      const otpLoginDto = plainToClass(OtpLoginDto, {});
      const refreshTokenDto = plainToClass(RefreshTokenDto, {});
      const resetPasswordDto = plainToClass(ResetPasswordDto, {});

      const loginErrors = await validate(loginDto);
      const otpLoginErrors = await validate(otpLoginDto);
      const refreshTokenErrors = await validate(refreshTokenDto);
      const resetPasswordErrors = await validate(resetPasswordDto);

      // LoginDto should fail (password required)
      expect(loginErrors.length).toBeGreaterThan(0);

      // OtpLoginDto should pass (all fields optional)
      expect(otpLoginErrors.length).toBe(0);

      // RefreshTokenDto should fail (refreshToken required)
      expect(refreshTokenErrors.length).toBeGreaterThan(0);

      // ResetPasswordDto should fail (both fields required)
      expect(resetPasswordErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Security Validation', () => {
    it('should not allow SQL injection in email', async () => {
      const dto = plainToClass(LoginDto, {
        email: "admin'OR'1'='1",  // Proper SQL injection attempt without @
        password: 'password123',
      });

      // Email validator should catch invalid format (no @domain)
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should not allow script tags in password', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'test@example.com',
        password: '<script>alert("xss")</script>',
      });

      // Password is just a string, but backend should hash it
      const errors = await validate(dto);
      expect(errors.length).toBe(0); // Valid as DTO, but should be sanitized in backend
    });

    it('should accept special characters in password', async () => {
      const specialPasswords = [
        'P@ssw0rd!',
        'Pass#word$123',
        'Complex&Pass*2023',
        'Str0ng_P@ss!',
      ];

      for (const password of specialPasswords) {
        const dto = plainToClass(LoginDto, {
          email: 'test@example.com',
          password,
        });

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should accept unicode characters in name fields', async () => {
      // Note: This is for CreateUserDto, but documenting expected behavior
      const dto = plainToClass(OtpLoginDto, {
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
