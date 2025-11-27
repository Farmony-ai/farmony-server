import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FcmTokenDto {
    @ApiProperty({
        description: 'FCM device token for push notifications',
        example: 'dGVzdC10b2tlbi1mb3ItZmNtLXB1c2gtbm90aWZpY2F0aW9ucw...',
    })
    @IsString()
    @IsNotEmpty()
    token: string;
}
