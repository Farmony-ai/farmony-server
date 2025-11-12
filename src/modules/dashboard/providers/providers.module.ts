import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ServiceRequestsModule } from '@transactions/service-requests/service-requests.module';
import { ListingsModule } from '@marketplace/listings/listings.module';
import { IdentityModule } from '@identity/identity.module';
import { CommonModule } from '@common/common.module';

@Module({
    imports: [
        CommonModule,
        ServiceRequestsModule,
        IdentityModule,
        ListingsModule,
    ],
    controllers: [ProvidersController],
    providers: [ProvidersService],
    exports: [ProvidersService],
})
export class ProvidersModule {}
