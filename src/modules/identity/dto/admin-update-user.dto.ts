import { IsOptional, IsBoolean, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateUserDto } from './update-user.dto';

/**
 * DTO for admin-only user updates.
 * Extends UpdateUserDto with privileged fields that only admins can modify.
 */
export class AdminUpdateUserDto extends UpdateUserDto {
    @ApiPropertyOptional({ description: 'Is user verified', example: true })
    @IsOptional()
    @IsBoolean()
    isVerified?: boolean;

    @ApiPropertyOptional({
        description: 'KYC status',
        enum: ['none', 'pending', 'approved', 'rejected'],
        example: 'approved',
    })
    @IsOptional()
    @IsString()
    @IsIn(['none', 'pending', 'approved', 'rejected'])
    kycStatus?: string;

    @ApiPropertyOptional({
        description: 'User role',
        enum: ['individual', 'SHG', 'FPO', 'admin'],
        example: 'individual',
    })
    @IsOptional()
    @IsString()
    @IsIn(['individual', 'SHG', 'FPO', 'admin'])
    role?: string;
}
