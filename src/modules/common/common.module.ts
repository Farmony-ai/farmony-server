import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notifications/notification.service';
import { FirebaseAdminService } from './firebase/firebase-admin.service';
import { FirebaseStorageService } from './firebase/firebase-storage.service';

@Module({
    imports: [ConfigModule],
    providers: [NotificationService, FirebaseAdminService, FirebaseStorageService],
    exports: [NotificationService, FirebaseAdminService, FirebaseStorageService],
})
export class CommonModule {}
