import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { User, UserDocument } from '../../../identity/schemas/users.schema';
import { Catalogue, CatalogueDocument } from '../../catalogue/schemas/catalogue.schema';
import { MatchRequest, MatchRequestDocument } from '../schemas/match-request.schema';
import { MatchCandidate, MatchCandidateDocument } from '../schemas/match-candidate.schema';
import { CreateMatchDto } from '../dto/create-match.dto';
import { FirebaseStorageService } from '../../../common/firebase/firebase-storage.service';
import { ProviderDiscoveryService } from './provider-discovery.service';

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
        private readonly storageService: FirebaseStorageService,
        private readonly providerDiscoveryService: ProviderDiscoveryService,
    ) {}

    async createMatch(dto: CreateMatchDto, idempotencyKey: string | null, seekerId: string | null): Promise<MatchResponse> {
        const { lat, lon, categoryId } = dto;
        const limit = dto.limit ?? 15;

        // Validate category exists
        const category = await this.catalogueModel.findById(categoryId).lean();
        if (!category) {
            throw new BadRequestException('Invalid category ID');
        }

        const maxRadius = MAX_RADIUS_BY_CATEGORY[categoryId] ?? MAX_RADIUS_BY_CATEGORY.default;

        // Listing-centric discovery via ProviderDiscoveryService
        const candidates = await this.providerDiscoveryService.findCandidates({
            coordinates: [lon, lat],
            radiusMeters: maxRadius,
            categoryId,
        });
        const limited = candidates.slice(0, limit);
        const status: MatchResponse['status'] = limited.length ? 'CREATED' : 'NO_COVERAGE';
        const requestId = randomUUID();

        // Transaction-like behavior without requiring Mongo transactions: use unique idempotency_key
        let existing: MatchRequestDocument | null = null;
        if (idempotencyKey) {
            existing = await this.matchRequestModel.findOne({ idempotency_key: idempotencyKey }).lean();
            if (existing) {
                const prior = await this.matchCandidateModel
                    .find({ request_id: existing._id })
                    .populate('provider_id', 'name phone profilePictureKey')
                    .sort({ rank_order: 1 })
                    .lean();
                return this.formatMatchResponse(String(existing._id), prior, existing.status as any);
            }
        }

        // Create request and candidates
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL
        await this.matchRequestModel.create({
            _id: requestId,
            seekerId: seekerId ? new Types.ObjectId(seekerId) : null,
            user_point: { type: 'Point', coordinates: [lon, lat] } as any,
            categoryId: new Types.ObjectId(categoryId),
            limit_n: limit,
            status,
            idempotency_key: idempotencyKey ?? null,
            expiresAt,
        });

        if (limited.length) {
            await this.matchCandidateModel.insertMany(
                limited.map((c: any, i: number) => ({
                    request_id: requestId,
                    provider_id: new Types.ObjectId(c.providerId),
                    distance_m: Math.round(c.distanceMeters),
                    rank_order: i + 1,
                }))
            );
        }

        // Hydrate provider contact/picture from users collection
        const providerIds = limited.map((c) => new Types.ObjectId(c.providerId));
        const users = providerIds.length
            ? await this.userModel.find({ _id: { $in: providerIds } }).select('name phone profilePictureKey').lean()
            : [];
        const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

        const providers = limited.map((c) => {
            const u = userMap.get(c.providerId);
            return {
                _id: c.providerId,
                name: u?.name ?? c.providerName ?? 'Provider',
                distance_m: Math.round(c.distanceMeters),
                phone: u?.phone,
                profilePictureUrl: u?.profilePictureKey ? this.storageService.getPublicUrl(u.profilePictureKey) : undefined,
            };
        });

        return { request_id: requestId, providers, status };
    }

    async getMatchRequest(requestId: string): Promise<any> {
        const request = await this.matchRequestModel.findById(requestId).populate('categoryId', 'name description').lean();

        if (!request) {
            throw new NotFoundException('Match request not found');
        }

        const candidates = await this.matchCandidateModel
            .find({ request_id: requestId })
            .populate('provider_id', 'name phone profilePictureKey isVerified')
            .sort({ rank_order: 1 })
            .lean();

        return {
            ...request,
            candidates: candidates.map((c: any) => ({
                ...c,
                profilePictureUrl: c.provider_id?.profilePictureKey ? this.storageService.getPublicUrl(c.provider_id.profilePictureKey) : undefined,
            })),
        };
    }

    private formatMatchResponse(requestId: string, candidates: any[], status: string): MatchResponse {
        const providers = candidates.map((c: any) => ({
            _id: String(c.provider_id._id),
            name: c.provider_id.name,
            distance_m: c.distance_m,
            phone: c.provider_id.phone,
            profilePictureUrl: c.provider_id.profilePictureKey ? this.storageService.getPublicUrl(c.provider_id.profilePictureKey) : undefined,
        }));

        return {
            request_id: requestId,
            providers,
            status: status as MatchResponse['status'],
        };
    }
}
