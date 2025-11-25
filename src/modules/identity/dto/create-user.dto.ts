import { IsString, IsEmail, IsPhoneNumber, IsOptional, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ description: 'Firebase User ID', example: 'abc123xyz' })
    @IsString()
    @IsNotEmpty()
    firebaseUserId: string;

    @ApiProperty({ description: 'User name', example: 'Ram Singh', minLength: 2, maxLength: 100 })
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name: string;

    @ApiPropertyOptional({ description: 'Email address', example: 'ram@example.com' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ description: 'Phone number with country code', example: '+919876543210' })
    @IsPhoneNumber()
    @IsOptional()
    phone?: string;
}
