import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMessageDto {
    @ApiProperty({ description: 'Message text content', example: 'Hello, when can you start?' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(5000)
    message: string;
}

