import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchRequest, MatchRequestSchema } from './schemas/match-request.schema';
import { MatchCandidate, MatchCandidateSchema } from './schemas/match-candidate.schema';
import { User, UserSchema } from '../users/users.schema';
import { Catalogue, CatalogueSchema } from '../catalogue/catalogue.schema';
import { AwsModule } from '../aws/aws.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MatchRequest.name, schema: MatchRequestSchema },
      { name: MatchCandidate.name, schema: MatchCandidateSchema },
      { name: User.name, schema: UserSchema },
      { name: Catalogue.name, schema: CatalogueSchema },
    ]),
    AwsModule,
    UsersModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}

