import { IsString, IsNotEmpty, IsEmail, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({
        description: 'Firebase ID token from client',
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
    })
    @IsString()
    @IsNotEmpty()
    idToken: string;

    @ApiProperty({
        description: 'User display name',
        example: 'Ram Singh',
        minLength: 2,
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name: string;

    @ApiPropertyOptional({
        description: 'Email address',
        example: 'ram@example.com',
    })
    @IsEmail()
    @IsOptional()
    email?: string;
}
