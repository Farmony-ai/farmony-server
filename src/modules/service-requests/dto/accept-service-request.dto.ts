import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AcceptServiceRequestDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  estimatedCompletionTime?: string;
}
