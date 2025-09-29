import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AcceptServiceRequestDto {
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  price: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  estimatedCompletionTime?: string;
}