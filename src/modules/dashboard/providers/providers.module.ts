import { Module, forwardRef } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { OrdersModule } from '../../bookings/orders/orders.module';
import { ListingsModule } from '../../bookings/services/listings/listings.module';
import { RatingsModule } from '../ratings/ratings.module';
import { ListingsService } from '../listings/listings.service';
import { Listing, ListingSchema } from '../listings/listings.schema';
import { IdentityModule } from '../../identity/identity.module';
import { ServiceRequestsModule } from '../../bookings/service-requests/service-requests.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ServiceRequest.name, schema: ServiceRequestSchema },
            { name: Listing.name, schema: ListingSchema },
        ]),
        ServiceRequestsModule,
        IdentityModule,
        ListingsModule,
    ],
    controllers: [ProvidersController],
    providers: [ProvidersService],
    exports: [ProvidersService],
})
export class ProvidersModule {}
