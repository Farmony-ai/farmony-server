import { Module } from '@nestjs/common';
import { SeekerController } from './seeker.controller';
import { SeekerService } from './seeker.service';
import { OrdersModule } from '../bookings/orders/orders.module';
import { ServiceRequestsModule } from '../bookings/service-requests/service-requests.module';

@Module({
    imports: [OrdersModule, ServiceRequestsModule],
    controllers: [SeekerController],
    providers: [SeekerService],
    exports: [SeekerService],
})
export class SeekerModule {}
