import { Module } from '@nestjs/common';
import { SeekerController } from './seeker.controller';
import { SeekerService } from './seeker.service';
import { ServiceRequestsModule } from '@transactions/service-requests/service-requests.module';
import { CommonModule } from '@common/common.module';

@Module({
    imports: [CommonModule, ServiceRequestsModule],
    controllers: [SeekerController],
    providers: [SeekerService],
    exports: [SeekerService],
})
export class SeekerModule {}
