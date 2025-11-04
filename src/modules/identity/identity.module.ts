import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './controllers/auth.controller';
import { UsersController } from './controllers/users.controller';
import { User, UserSchema } from './schemas/users.schema';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [ConfigModule, CommonModule, MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
    providers: [AuthService, UsersService, FirebaseAuthGuard, RolesGuard],
    controllers: [AuthController, UsersController],
    exports: [AuthService, UsersService, FirebaseAuthGuard, RolesGuard],
})
export class IdentityModule {}
