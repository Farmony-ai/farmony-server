import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceRequest, ServiceRequestSchema } from './schemas/service-request.entity';
import { Order, OrderSchema } from './schemas/orders.schema';
import { CommonModule } from '../../common/common.module';
import { IdentityModule } from '../../identity/identity.module';
import { MarketplaceModule } from '../../marketplace/marketplace.module';
import { EngagementModule } from '../../engagement/engagement.module';
import { ServiceRequestsService } from './services/service-requests.service';
import { OrdersService } from './services/orders.service';
import { ServiceRequestsController } from './controllers/service-requests.controller';
import { OrdersController } from './controllers/orders.controller';
import { PublicServiceRequestsController } from './controllers/public-service-requests.controller';

@Module({
    imports: [
        CommonModule,
        IdentityModule,
        forwardRef(() => MarketplaceModule),
        EngagementModule,
        MongooseModule.forFeature([
            { name: ServiceRequest.name, schema: ServiceRequestSchema },
            { name: Order.name, schema: OrderSchema },
        ]),
    ],
    providers: [ServiceRequestsService, OrdersService],
    controllers: [ServiceRequestsController, OrdersController, PublicServiceRequestsController],
    exports: [ServiceRequestsService, OrdersService],
})
export class ServiceRequestsModule { }
