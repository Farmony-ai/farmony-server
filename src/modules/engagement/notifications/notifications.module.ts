import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { IdentityModule } from '../../identity/identity.module';
import { NotificationService } from './services/notification.service';

@Module({
    imports: [ConfigModule, CommonModule, IdentityModule],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationsModule {}
