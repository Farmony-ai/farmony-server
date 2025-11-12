import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProviderDiscoveryService } from '../matches/services/provider-discovery.service';
import { Listing } from '../schemas/listings.schema';
import { Types } from 'mongoose';

describe('ProviderDiscoveryService', () => {
    let service: ProviderDiscoveryService;
    let mockListingModel: any;

    beforeEach(async () => {
        mockListingModel = {
            aggregate: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProviderDiscoveryService,
                {
                    provide: getModelToken(Listing.name),
                    useValue: mockListingModel,
                },
            ],
        }).compile();

        service = module.get<ProviderDiscoveryService>(ProviderDiscoveryService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findCandidates', () => {
        it('should find providers within radius matching category', async () => {
            const mockResults = [
                {
                    _id: 'listing1',
                    providerId: new Types.ObjectId(),
                    categoryId: new Types.ObjectId(),
                    distance: 3000,
                    provider: {
                        _id: new Types.ObjectId(),
                        name: 'Provider 1',
                        isVerified: true,
                        kycStatus: 'approved',
                    },
                    isActive: true,
                },
                {
                    _id: 'listing2',
                    providerId: new Types.ObjectId(),
                    categoryId: new Types.ObjectId(),
                    distance: 5000,
                    provider: {
                        _id: new Types.ObjectId(),
                        name: 'Provider 2',
                        isVerified: true,
                        kycStatus: 'approved',
                    },
                    isActive: true,
                },
            ];

            mockListingModel.aggregate.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockResults),
            });

            const result = await service.findCandidates({
                coordinates: [77.5946, 12.9716],
                radiusMeters: 10000,
                categoryId: new Types.ObjectId().toString(),
            });

            expect(result).toHaveLength(2);
            expect(result[0].distanceMeters).toBe(3000);
            expect(result[1].distanceMeters).toBe(5000);
            expect(mockListingModel.aggregate).toHaveBeenCalled();
        });

        it('should filter by subcategory when provided', async () => {
            mockListingModel.aggregate.mockReturnValue({
                exec: jest.fn().mockResolvedValue([]),
            });

            await service.findCandidates({
                coordinates: [77.5946, 12.9716],
                radiusMeters: 10000,
                categoryId: new Types.ObjectId().toString(),
                subCategoryId: new Types.ObjectId().toString(),
            });

            const aggregateCall = mockListingModel.aggregate.mock.calls[0][0];
            const matchStage = aggregateCall.find((stage: any) => stage.$match && stage.$match.categoryId);

            expect(matchStage.$match.subCategoryId).toBeDefined();
        });

        it('should exclude specified providers', async () => {
            const excludedProviderId = new Types.ObjectId();
            const includedProviderId = new Types.ObjectId();

            const mockResults = [
                {
                    _id: 'listing1',
                    providerId: excludedProviderId,
                    categoryId: new Types.ObjectId(),
                    distance: 3000,
                    provider: {
                        _id: excludedProviderId,
                        name: 'Excluded Provider',
                        isVerified: true,
                        kycStatus: 'approved',
                    },
                    isActive: true,
                },
                {
                    _id: 'listing2',
                    providerId: includedProviderId,
                    categoryId: new Types.ObjectId(),
                    distance: 5000,
                    provider: {
                        _id: includedProviderId,
                        name: 'Included Provider',
                        isVerified: true,
                        kycStatus: 'approved',
                    },
                    isActive: true,
                },
            ];

            mockListingModel.aggregate.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockResults),
            });

            const result = await service.findCandidates({
                coordinates: [77.5946, 12.9716],
                radiusMeters: 10000,
                categoryId: new Types.ObjectId().toString(),
                excludeProviderIds: [excludedProviderId.toString()],
            });

            expect(result).toHaveLength(1);
            expect(result[0].providerId).toBe(includedProviderId.toString());
        });

        it('should return empty array when no providers in radius', async () => {
            mockListingModel.aggregate.mockReturnValue({
                exec: jest.fn().mockResolvedValue([]),
            });

            const result = await service.findCandidates({
                coordinates: [77.5946, 12.9716],
                radiusMeters: 1000,
                categoryId: new Types.ObjectId().toString(),
            });

            expect(result).toHaveLength(0);
        });

        it('should sort providers by distance (nearest first)', async () => {
            const mockResults = [
                {
                    _id: 'listing1',
                    providerId: new Types.ObjectId(),
                    distance: 8000,
                    provider: { _id: new Types.ObjectId(), name: 'Far', isVerified: true, kycStatus: 'approved' },
                    isActive: true,
                    categoryId: new Types.ObjectId(),
                },
                {
                    _id: 'listing2',
                    providerId: new Types.ObjectId(),
                    distance: 2000,
                    provider: { _id: new Types.ObjectId(), name: 'Near', isVerified: true, kycStatus: 'approved' },
                    isActive: true,
                    categoryId: new Types.ObjectId(),
                },
            ];

            mockListingModel.aggregate.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockResults),
            });

            const result = await service.findCandidates({
                coordinates: [77.5946, 12.9716],
                radiusMeters: 10000,
                categoryId: new Types.ObjectId().toString(),
            });

            // Results should maintain aggregate sort order
            expect(result[0].distanceMeters).toBe(8000);
            expect(result[1].distanceMeters).toBe(2000);
        });

        it('should only include one listing per provider', async () => {
            const providerId = new Types.ObjectId();

            const mockResults = [
                {
                    _id: 'listing1',
                    providerId: providerId,
                    distance: 3000,
                    provider: { _id: providerId, name: 'Provider', isVerified: true, kycStatus: 'approved' },
                    isActive: true,
                    categoryId: new Types.ObjectId(),
                },
                {
                    _id: 'listing2',
                    providerId: providerId,
                    distance: 5000,
                    provider: { _id: providerId, name: 'Provider', isVerified: true, kycStatus: 'approved' },
                    isActive: true,
                    categoryId: new Types.ObjectId(),
                },
            ];

            mockListingModel.aggregate.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockResults),
            });

            const result = await service.findCandidates({
                coordinates: [77.5946, 12.9716],
                radiusMeters: 10000,
                categoryId: new Types.ObjectId().toString(),
            });

            expect(result).toHaveLength(1);
            expect(result[0].distanceMeters).toBe(3000); // Should take the first (closest) listing
        });
    });
});
