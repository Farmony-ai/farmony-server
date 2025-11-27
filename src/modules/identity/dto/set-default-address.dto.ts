import { IsNotEmpty, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetDefaultAddressDto {
    @ApiProperty({
        description: 'Address ID to set as default',
        example: '507f1f77bcf86cd799439011',
    })
    @IsNotEmpty()
    @IsMongoId()
    addressId: string;
}
