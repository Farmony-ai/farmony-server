import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        description: 'Firebase ID token from client',
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
    })
    @IsString()
    @IsNotEmpty()
    idToken: string;
}
