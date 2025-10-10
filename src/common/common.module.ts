import { Module } from '@nestjs/common';
import { AddressResolverService } from './services/address-resolver.service';
import { AddressesModule } from '../modules/addresses/addresses.module';

@Module({
  imports: [AddressesModule],
  providers: [AddressResolverService],
  exports: [AddressResolverService],
})
export class CommonModule {}