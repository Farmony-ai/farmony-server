import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Listing, ListingSchema } from './schemas/listings.schema';
import { Availability, AvailabilitySchema } from './schemas/availability.schema';
import { Catalogue, CatalogueSchema } from '../catalogue/schemas/catalogue.schema';
import { CommonModule } from '@common/common.module';
import { IdentityModule } from '@identity/identity.module';
import { ListingsService } from './services/listings.service';
import { AvailabilitiesService } from './services/availabilities.service';
import { ListingsController } from './controllers/listings.controller';
import { AvailabilitiesController } from './controllers/availabilities.controller';

@Module({
    imports: [
        CommonModule,
        IdentityModule,
        MongooseModule.forFeature([
            { name: Listing.name, schema: ListingSchema },
            { name: Availability.name, schema: AvailabilitySchema },
            { name: Catalogue.name, schema: CatalogueSchema },
        ]),
    ],
    providers: [ListingsService, AvailabilitiesService],
    controllers: [ListingsController, AvailabilitiesController],
    exports: [ListingsService, AvailabilitiesService],
})
export class ListingsModule {}
