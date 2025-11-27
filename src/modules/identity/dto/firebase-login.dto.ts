import { IsString, IsNotEmpty, IsEmail, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FirebaseLoginDto {
    @ApiProperty({
        description: 'Firebase ID token from OTP verification',
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
    })
    @IsString()
    @IsNotEmpty()
    idToken: string;

    @ApiPropertyOptional({
        description: 'User display name (required for first-time registration)',
        example: 'Ram Singh',
        minLength: 2,
        maxLength: 100,
    })
    @IsString()
    @IsOptional()
    @Length(2, 100)
    name?: string;

    @ApiPropertyOptional({
        description: 'Phone number with country code',
        example: '+919876543210',
    })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({
        description: 'Email address',
        example: 'ram@example.com',
    })
    @IsEmail()
    @IsOptional()
    email?: string;
}
