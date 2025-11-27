import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Listing, ListingSchema } from './listings.schema';
import { Availability, AvailabilitySchema } from './availability.schema';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { AvailabilitiesService } from './availabilities.service';
import { AvailabilitiesController } from './availabilities.controller';
import { AwsModule } from '../aws/aws.module';
import { UsersModule } from '../users/users.module';
import { AddressesModule } from '../addresses/addresses.module';
import { Catalogue, CatalogueSchema } from '../catalogue/catalogue.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Listing.name, schema: ListingSchema },
      { name: Availability.name, schema: AvailabilitySchema },
      { name: Catalogue.name, schema: CatalogueSchema }
    ]),
    AwsModule, 
    UsersModule, 
    AddressesModule,
  ],
  providers: [ListingsService, AvailabilitiesService],
  controllers: [ListingsController, AvailabilitiesController],
  exports: [ListingsService],
})
export class ListingsModule {}