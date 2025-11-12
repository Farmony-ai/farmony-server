import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { FirebaseAdminService } from './firebase/firebase-admin.service';
import { FirebaseStorageService } from './firebase/firebase-storage.service';
import { GeoService } from './geo/geo.service';
import { User, UserSchema } from '@identity/schemas/users.schema';

@Module({
    imports: [
        ConfigModule,
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema }
        ])
    ],
    providers: [
        FirebaseAdminService,
        FirebaseStorageService,
        GeoService,
    ],
    exports: [
        FirebaseAdminService,
        FirebaseStorageService,
        GeoService,
    ],
})
export class CommonModule {}
