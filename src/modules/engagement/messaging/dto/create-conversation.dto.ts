import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateConversationDto {
    @ApiProperty({ description: 'Other participant user ID', example: '507f1f77bcf86cd799439011' })
    @Transform(({ value }) => {
        if (value === null || value === undefined) {
            return value;
        }
        
        if (typeof value === 'string') {
            return value.trim();
        }
        
        if (typeof value === 'number') {
            return String(value);
        }
        
        if (value && typeof value === 'object' && '_id' in value) {
            const idValue = (value as any)._id;
            if (typeof idValue === 'string') {
                return idValue.trim();
            }
            if (idValue !== null && idValue !== undefined) {
                return String(idValue).trim();
            }
        }
        
        try {
            return String(value).trim();
        } catch {
            return value;
        }
    })
    @IsMongoId({ message: 'participantId must be a valid MongoDB ObjectId' })
    participantId: string;

    @ApiPropertyOptional({ description: 'Related order ID', example: '507f1f77bcf86cd799439012' })
    @Transform(({ value }) => {
        if (!value || value === null || value === undefined) {
            return undefined;
        }
        
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed === '' ? undefined : trimmed;
        }
        
        if (typeof value === 'number') {
            return String(value);
        }
        
        if (value && typeof value === 'object' && '_id' in value) {
            const idValue = (value as any)._id;
            if (typeof idValue === 'string') {
                const trimmed = idValue.trim();
                return trimmed === '' ? undefined : trimmed;
            }
            if (idValue !== null && idValue !== undefined) {
                return String(idValue).trim();
            }
        }
        
        try {
            const str = String(value).trim();
            return str === '' ? undefined : str;
        } catch {
            return undefined;
        }
    })
    @IsMongoId({ message: 'orderId must be a valid MongoDB ObjectId' })
    @IsOptional()
    orderId?: string;
}

