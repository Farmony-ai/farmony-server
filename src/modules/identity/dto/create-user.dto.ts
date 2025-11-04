import { IsString, IsEmail, IsPhoneNumber, IsOptional } from 'class-validator';

export class CreateUserDto {
    @IsString()
    name: string;

    @IsEmail()
    @IsOptional()
    email: string;

    @IsPhoneNumber('ZZ')
    phone: string;
}
