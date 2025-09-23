import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { User, UserDocument } from '../users/users.schema';
import { Catalogue, CatalogueDocument } from '../catalogue/catalogue.schema';
import { MatchRequest, MatchRequestDocument } from './schemas/match-request.schema';
import { MatchCandidate, MatchCandidateDocument } from './schemas/match-candidate.schema';
import { CreateMatchDto } from './dto/create-match.dto';
import { S3Service } from '../aws/s3.service';

export type MatchResponse = {
  request_id: string;
  providers: Array<{
    _id: string;
    name: string;
    distance_m: number;
    phone?: string;
    profilePictureUrl?: string;
  }>;
  status: 'CREATED' | 'NO_COVERAGE';
};

const MAX_RADIUS_BY_CATEGORY: Record<string, number> = {
  default: 20000,
};

@Injectable()
export class MatchesService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Catalogue.name) private readonly catalogueModel: Model<CatalogueDocument>,
    @InjectModel(MatchRequest.name) private readonly matchRequestModel: Model<MatchRequestDocument>,
    @InjectModel(MatchCandidate.name) private readonly matchCandidateModel: Model<MatchCandidateDocument>,
    private readonly s3Service: S3Service,
  ) {}

  async createMatch(
    dto: CreateMatchDto,
    idempotencyKey: string | null,
    seekerId: string | null,
  ): Promise<MatchResponse> {
    const { lat, lon, categoryId } = dto;
    const limit = dto.limit ?? 15;

    // Validate category exists
    const category = await this.catalogueModel.findById(categoryId).lean();
    if (!category) {
      throw new BadRequestException('Invalid category ID');
    }

    const maxRadius = MAX_RADIUS_BY_CATEGORY[categoryId] ?? MAX_RADIUS_BY_CATEGORY.default;

    // Build aggregation pipeline
    const pipeline: any[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lon, lat] },
          key: 'coordinates',
          spherical: true,
          distanceField: 'distance_m',
          maxDistance: maxRadius,
          query: {
            serviceCategories: new Types.ObjectId(categoryId),
            isVerified: true,
            kycStatus: 'approved',
            serviceRadius: { $exists: true, $gt: 0 },
          },
        },
      },
      { $match: { $expr: { $lte: ['$distance_m', '$serviceRadius'] } } },
      { $sort: { distance_m: 1, qualityScore: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          phone: 1,
          profilePicture: 1,
          distance_m: 1,
        },
      },
    ];

    const hits = await this.userModel.aggregate(pipeline).exec();
    const status: MatchResponse['status'] = hits.length ? 'CREATED' : 'NO_COVERAGE';
    const requestId = randomUUID();

    // Transaction-like behavior without requiring Mongo transactions: use unique idempotency_key
    let existing: MatchRequestDocument | null = null;
    if (idempotencyKey) {
      existing = await this.matchRequestModel.findOne({ idempotency_key: idempotencyKey }).lean();
      if (existing) {
        const prior = await this.matchCandidateModel
          .find({ request_id: existing._id })
          .populate('provider_id', 'name phone profilePicture')
          .sort({ rank_order: 1 })
          .lean();
        return this.formatMatchResponse(String(existing._id), prior, existing.status as any);
      }
    }

    // Create request and candidates
    await this.matchRequestModel.create({
      _id: requestId,
      seekerId: seekerId ? new Types.ObjectId(seekerId) : null,
      user_point: { type: 'Point', coordinates: [lon, lat] } as any,
      categoryId: new Types.ObjectId(categoryId),
      limit_n: limit,
      status,
      idempotency_key: idempotencyKey ?? null,
    });

    if (hits.length) {
      await this.matchCandidateModel.insertMany(
        hits.map((p: any, i: number) => ({
          request_id: requestId,
          provider_id: p._id,
          distance_m: Math.round(p.distance_m),
          rank_order: i + 1,
        })),
      );
    }

    const providers = hits.map((p: any) => ({
      _id: String(p._id),
      name: p.name,
      distance_m: Math.round(p.distance_m),
      phone: p.phone,
      profilePictureUrl: p.profilePicture ? this.s3Service.getPublicUrl(p.profilePicture) : undefined,
    }));

    return { request_id: requestId, providers, status };
  }

  async getMatchRequest(requestId: string): Promise<any> {
    const request = await this.matchRequestModel
      .findById(requestId)
      .populate('categoryId', 'name description')
      .lean();

    if (!request) {
      throw new NotFoundException('Match request not found');
    }

    const candidates = await this.matchCandidateModel
      .find({ request_id: requestId })
      .populate('provider_id', 'name phone profilePicture isVerified')
      .sort({ rank_order: 1 })
      .lean();

    return {
      ...request,
      candidates: candidates.map((c: any) => ({
        ...c,
        profilePictureUrl: c.provider_id?.profilePicture
          ? this.s3Service.getPublicUrl(c.provider_id.profilePicture)
          : undefined,
      })),
    };
  }

  private formatMatchResponse(requestId: string, candidates: any[], status: string): MatchResponse {
    const providers = candidates.map((c: any) => ({
      _id: String(c.provider_id._id),
      name: c.provider_id.name,
      distance_m: c.distance_m,
      phone: c.provider_id.phone,
      profilePictureUrl: c.provider_id.profilePicture
        ? this.s3Service.getPublicUrl(c.provider_id.profilePicture)
        : undefined,
    }));

    return {
      request_id: requestId,
      providers,
      status: status as MatchResponse['status'],
    };
  }
}

