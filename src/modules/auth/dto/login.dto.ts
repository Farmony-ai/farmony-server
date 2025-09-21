import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'; // ADD THIS LINE

export class LoginDto {
  // @ApiPropertyOptional({ example: 'john@example.com' })  // REMOVE THIS
  @IsOptional()
  @IsEmail()
  email?: string;

  // @ApiPropertyOptional({ example: '9876543210' })  // REMOVE THIS
  @IsOptional()
  @IsString()
  phone?: string;

  // @ApiProperty({ example: 'Password123' })  // REMOVE THIS
  @IsString()
  @IsNotEmpty()
  password: string;
}