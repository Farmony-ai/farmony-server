import { IsNotEmpty, IsString } from 'class-validator';

export class SetDefaultAddressDto {
  @IsNotEmpty()
  @IsString()
  addressId: string;
}
