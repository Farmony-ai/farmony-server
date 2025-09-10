import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { KycModule } from './modules/kyc/kyc.module';
import { ListingsModule } from './modules/listings/listings.module';
import { OrdersModule } from './modules/orders/orders.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { ChatModule } from './modules/chat/chat.module';
import { MessagesModule } from './modules/messages/messages.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import databaseConfig from './config/database.config';
import { AwsModule } from './modules/aws/aws.module';

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
        uri: (process.env.NODE_ENV === 'prod')
            ? cfg.get<string>('MONGO_URI_PROD')
            : cfg.get<string>('MONGO_URI_DEV'),
      }),
    }),
    // ScheduleModule.forRoot(), // For cron jobs
    UsersModule,
    AuthModule,
    KycModule,
    ListingsModule,
    OrdersModule,
    EscrowModule,
    CommissionsModule,
    RatingsModule,
    AddressesModule,
    CatalogueModule,
    ProvidersModule,
    ChatModule,
    MessagesModule,
    DisputesModule,
    AwsModule
  ],
})
export class AppModule {}