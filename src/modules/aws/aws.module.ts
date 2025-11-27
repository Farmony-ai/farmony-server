// src/modules/aws/aws.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from './s3.service';

@Module({
  imports: [ConfigModule], // S3Service depends on ConfigService
  providers: [S3Service],
  exports: [S3Service],   // 👈 Export S3Service so other modules can use it
})
export class AwsModule {}