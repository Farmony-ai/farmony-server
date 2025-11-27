import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KycDocument, KycDocumentSchema } from './kyc.schema';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { AwsModule } from '../aws/aws.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KycDocument.name, schema: KycDocumentSchema },
    ]),
    AwsModule
  ],
  providers: [KycService],
  controllers: [KycController],
  exports: [KycService],
})
export class KycModule {}
