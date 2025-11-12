import { IsString, IsEmail, IsPhoneNumber, IsOptional } from 'class-validator';

export class CreateUserDto {
    @IsString()
    name: string;

    @IsEmail()
    @IsOptional()
    email: string;

    @IsPhoneNumber(null) // Accept any country code
    phone: string;
}
