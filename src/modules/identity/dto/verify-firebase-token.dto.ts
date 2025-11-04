import { IsString, IsNotEmpty, IsPhoneNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyFirebaseTokenDto {
    @ApiProperty({
        description: 'Firebase ID token from client',
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
    })
    @IsString()
    @IsNotEmpty()
    idToken: string;

    @ApiProperty({
        description: 'Phone number with country code',
        example: '+1234567890',
        required: false,
    })
    @IsPhoneNumber('IN')
    @IsOptional()
    phoneNumber?: string;

    @ApiProperty({
        description: 'User name for new registrations',
        example: 'John Doe',
        required: false,
    })
    @IsString()
    @IsOptional()
    name?: string;
}
