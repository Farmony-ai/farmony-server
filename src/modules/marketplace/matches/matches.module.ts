import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatchRequest, MatchRequestSchema } from './schemas/match-request.schema';
import { MatchCandidate, MatchCandidateSchema } from './schemas/match-candidate.schema';
import { Catalogue, CatalogueSchema } from '../catalogue/schemas/catalogue.schema';
import { ServiceRequest, ServiceRequestSchema } from '../../transactions/service-requests/schemas/service-request.entity';
import { User, UserSchema } from '../../identity/schemas/users.schema';
import { Listing, ListingSchema } from '../listings/schemas/listings.schema';
import { CommonModule } from '../../common/common.module';
import { IdentityModule } from '../../identity/identity.module';
import { EngagementModule } from '../../engagement/engagement.module';
import { MessagingModule } from '../../engagement/messaging/messaging.module';
import { TransactionsModule } from '../../transactions/transactions.module';
import { ListingsModule } from '../listings/listings.module';
import { MatchesService } from './services/matches.service';
import { MatchesOrchestratorService } from './services/matches-orchestrator.service';
import { ProviderDiscoveryService } from './services/provider-discovery.service';
import { WaveSchedulerService } from './services/wave-scheduler.service';
import { MatchesController } from './controllers/matches.controller';

@Module({
    imports: [
        CommonModule,
        IdentityModule,
        EngagementModule,
        MessagingModule,
        forwardRef(() => TransactionsModule),
        forwardRef(() => ListingsModule),
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Listing.name, schema: ListingSchema },
            { name: MatchRequest.name, schema: MatchRequestSchema },
            { name: MatchCandidate.name, schema: MatchCandidateSchema },
            { name: Catalogue.name, schema: CatalogueSchema },
            { name: ServiceRequest.name, schema: ServiceRequestSchema },
        ]),
    ],
    providers: [
        MatchesService,
        MatchesOrchestratorService,
        ProviderDiscoveryService,
        WaveSchedulerService,
    ],
    controllers: [MatchesController],
    exports: [
        MatchesService,
        MatchesOrchestratorService,
        ProviderDiscoveryService,
        WaveSchedulerService,
    ],
})
export class MatchesModule {}
