import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagingController } from './controllers/messaging.controller';
import { MessagingService } from './services/messaging.service';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { ConversationBucket, ConversationBucketSchema } from './schemas/conversation-bucket.schema';
import { CommonModule } from '../../common/common.module';
import { IdentityModule } from '../../identity/identity.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Conversation.name, schema: ConversationSchema },
            { name: ConversationBucket.name, schema: ConversationBucketSchema },
        ]),
        CommonModule,
        IdentityModule, 
    ],
    controllers: [MessagingController],
    providers: [MessagingService],
    exports: [MessagingService],
})
export class MessagingModule {}

