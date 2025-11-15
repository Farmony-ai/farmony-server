import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { IdentityModule } from './modules/identity/identity.module';
import { CommonModule } from './modules/common/common.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { ProvidersModule } from './modules/dashboard/providers/providers.module';
import { SeekerModule } from './modules/dashboard/seekers/seekers.module';
import databaseConfig from './modules/common/config/database.config';

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
        CommonModule, // Provides Firebase, Storage, and stub services
        IdentityModule, // Users and authentication
        MarketplaceModule, // Listings, Matches, Catalogue
        TransactionsModule, // Service Requests, Orders
        EngagementModule, // Notifications
        ProvidersModule, // Dashboard - Provider view
        SeekerModule, // Dashboard - Seeker view
    ],
})
export class AppModule {}
