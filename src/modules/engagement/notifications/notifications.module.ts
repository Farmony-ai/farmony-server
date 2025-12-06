import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../../common/common.module';
import { IdentityModule } from '../../identity/identity.module';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { User, UserSchema } from '../../identity/schemas/users.schema';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Notification.name, schema: NotificationSchema },
            { name: User.name, schema: UserSchema },
        ]),
        ConfigModule,
        CommonModule,
        forwardRef(() => IdentityModule),
    ],
    controllers: [NotificationController],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationsModule {}
