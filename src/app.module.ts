import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './modules/users/users.module';
import { CommonModule } from './modules/common/common.module';
import { KycModule } from './modules/kyc/kyc.module';
import { ListingsModule } from './modules/bookings/services/listings/listings.module';
import { OrdersModule } from './modules/bookings/orders/orders.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { ProvidersModule } from './modules/dashboard/providers/providers.module';
import { ChatModule } from './modules/chat/chat.module';
import { MessagesModule } from './modules/messages/messages.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import databaseConfig from './modules/common/config/database.config';
import { MatchesModule } from './modules/bookings/matches/matches.module';
import { ServiceRequestsModule } from './modules/bookings/service-requests/service-requests.module';
import { SeekerModule } from './modules/seeker/seeker.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`,
            load: [databaseConfig],
        }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (cfg: ConfigService) => ({
                uri: process.env.NODE_ENV === 'prod' ? cfg.get<string>('MONGO_URI_PROD') : cfg.get<string>('MONGO_URI_DEV'),
            }),
        }),
        // ScheduleModule.forRoot(), // For cron jobs
        CommonModule, // Provides Auth, AWS, and shared services
        UsersModule,
        KycModule,
        ListingsModule,
        OrdersModule,
        EscrowModule,
        CommissionsModule,
        RatingsModule,
        AddressesModule,
        ProvidersModule,
        ChatModule,
        MessagesModule,
        DisputesModule,
        MatchesModule,
        ServiceRequestsModule,
        SeekerModule,
    ],
})
export class AppModule {}
