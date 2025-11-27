import { Module, forwardRef } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { OrdersModule } from '../orders/orders.module';
import { ListingsModule } from '../listings/listings.module';
import { RatingsModule } from '../ratings/ratings.module';
import { UsersModule } from '../users/users.module';
import { ServiceRequestsModule } from '../service-requests/service-requests.module';

@Module({
  imports: [
    OrdersModule,
    ListingsModule,
    RatingsModule,
    UsersModule,
    forwardRef(() => ServiceRequestsModule),
  ],
  controllers: [ProvidersController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}