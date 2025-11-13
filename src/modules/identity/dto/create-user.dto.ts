import { IsString, IsEmail, IsPhoneNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ description: 'User name', example: 'Ram Singh' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ description: 'Email address', example: 'ram@example.com' })
    @IsEmail()
    @IsOptional()
    email: string;

    @ApiProperty({ description: 'Phone number with country code', example: '+919876543210' })
    @IsPhoneNumber(null) // Accept any country code
    phone: string;
}
