import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MatchesOrchestratorService } from '../matches/services/matches-orchestrator.service';
import { ServiceRequest, ServiceRequestStatus } from '../schemas/service-request.entity';
import { ProviderDiscoveryService } from '../matches/services/provider-discovery.service';
import { NotificationService } from '../../../common/services/notification.service';
import { ListingsService } from '../../listings/listings.service';
import { OrdersService } from './orders.service';
import { Types } from 'mongoose';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('MatchesOrchestratorService', () => {
    let service: MatchesOrchestratorService;
    let mockServiceRequestModel: any;
    let mockProviderDiscoveryService: jest.Mocked<ProviderDiscoveryService>;
    let mockNotificationService: jest.Mocked<NotificationService>;
    let mockListingsService: jest.Mocked<ListingsService>;
    let mockOrdersService: jest.Mocked<OrdersService>;

    beforeEach(async () => {
        mockServiceRequestModel = {
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            findOneAndUpdate: jest.fn(),
        };

        mockProviderDiscoveryService = {
            findCandidates: jest.fn(),
        } as any;

        mockNotificationService = {
            notifyProvidersNewRequest: jest.fn(),
            notifySeekerNoProviders: jest.fn(),
            notifySeekerAccepted: jest.fn(),
            notifyProvidersClosed: jest.fn(),
        } as any;

        mockListingsService = {
            findByProvider: jest.fn(),
        } as any;

        mockOrdersService = {
            createFromServiceRequest: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MatchesOrchestratorService,
                {
                    provide: getModelToken(ServiceRequest.name),
                    useValue: mockServiceRequestModel,
                },
                {
                    provide: ProviderDiscoveryService,
                    useValue: mockProviderDiscoveryService,
                },
                {
                    provide: NotificationService,
                    useValue: mockNotificationService,
                },
                {
                    provide: ListingsService,
                    useValue: mockListingsService,
                },
                {
                    provide: OrdersService,
                    useValue: mockOrdersService,
                },
            ],
        }).compile();

        service = module.get<MatchesOrchestratorService>(MatchesOrchestratorService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('processNextWave', () => {
        it('should process wave and notify providers', async () => {
            const mockRequest: any = {
                _id: 'req123',
                status: ServiceRequestStatus.OPEN,
                currentWave: 0,
                location: { coordinates: [77.5946, 12.9716] },
                categoryId: new Types.ObjectId(),
                subCategoryId: new Types.ObjectId(),
                allNotifiedProviders: [],
                notificationWaves: [],
                save: jest.fn().mockResolvedValue(true),
            };

            const provider1Id = new Types.ObjectId();
            const provider2Id = new Types.ObjectId();
            const mockCandidates = [
                { providerId: provider1Id.toString(), distanceMeters: 3000, listing: {}, providerName: 'Provider 1' },
                { providerId: provider2Id.toString(), distanceMeters: 5000, listing: {}, providerName: 'Provider 2' },
            ];

            // Mock the query chain: findById().populate().populate()
            mockServiceRequestModel.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(mockRequest),
                }),
            });

            mockProviderDiscoveryService.findCandidates.mockResolvedValue(mockCandidates);

            const result = await service.processNextWave('req123');

            expect(result.waveNumber).toBe(1);
            expect(result.providersNotified).toBe(2);
            expect(result.nextWaveScheduled).toBe(true);
            expect(mockNotificationService.notifyProvidersNewRequest).toHaveBeenCalled();
            expect(mockRequest.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException if request not found', async () => {
            mockServiceRequestModel.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(null),
                }),
            });

            await expect(service.processNextWave('invalid-id')).rejects.toThrow(NotFoundException);
        });

        it('should skip processing if request is not in OPEN or MATCHED status', async () => {
            const mockRequest = {
                _id: 'req123',
                status: ServiceRequestStatus.ACCEPTED,
                currentWave: 1,
            };

            mockServiceRequestModel.findById.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockRequest),
            });

            const result = await service.processNextWave('req123');

            expect(result.providersNotified).toBe(0);
            expect(result.nextWaveScheduled).toBe(false);
        });

        it('should advance to next wave if insufficient providers', async () => {
            const mockRequest: any = {
                _id: 'req123',
                status: ServiceRequestStatus.OPEN,
                currentWave: 0,
                location: { coordinates: [77.5946, 12.9716] },
                categoryId: new Types.ObjectId(),
                subCategoryId: new Types.ObjectId(),
                allNotifiedProviders: [],
                notificationWaves: [],
                save: jest.fn().mockResolvedValue(true),
            };

            const provider1Id = new Types.ObjectId();

            mockServiceRequestModel.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(mockRequest),
                }),
            });

            mockProviderDiscoveryService.findCandidates
                .mockResolvedValueOnce([]) // Wave 1: no providers
                .mockResolvedValueOnce([{ providerId: provider1Id.toString(), distanceMeters: 8000, listing: {}, providerName: 'P1' }]); // Wave 2: 1 provider

            await service.processNextWave('req123');

            expect(mockProviderDiscoveryService.findCandidates).toHaveBeenCalledTimes(2);
        });

        it('should mark as NO_PROVIDERS_AVAILABLE when max waves reached', async () => {
            const mockRequest: any = {
                _id: 'req123',
                seekerId: new Types.ObjectId(),
                status: ServiceRequestStatus.OPEN,
                currentWave: 5, // Already at max
                location: { coordinates: [77.5946, 12.9716] },
                categoryId: new Types.ObjectId(),
                allNotifiedProviders: [],
                cancellationReason: '',
                save: jest.fn(),
            };

            mockRequest.save.mockImplementation(function (this: any) {
                this.status = ServiceRequestStatus.NO_PROVIDERS_AVAILABLE;
                return Promise.resolve(this);
            });

            mockServiceRequestModel.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(mockRequest),
                }),
            });

            await service.processNextWave('req123');

            expect(mockRequest.save).toHaveBeenCalled();
            expect(mockRequest.status).toBe(ServiceRequestStatus.NO_PROVIDERS_AVAILABLE);
            expect(mockNotificationService.notifySeekerNoProviders).toHaveBeenCalled();
        });
    });

    describe('accept', () => {
        it('should validate provider was notified', async () => {
            const mockRequest = {
                _id: 'req123',
                status: ServiceRequestStatus.MATCHED,
                allNotifiedProviders: [new Types.ObjectId()],
                expiresAt: new Date(Date.now() + 10000),
                categoryId: new Types.ObjectId(),
            };

            mockServiceRequestModel.findById.mockResolvedValue(mockRequest);

            await expect(service.accept('req123', 'other-provider-id')).rejects.toThrow(ForbiddenException);
        });

        it('should validate request is in MATCHED status', async () => {
            const providerId = new Types.ObjectId();
            const mockRequest = {
                _id: 'req123',
                status: ServiceRequestStatus.ACCEPTED,
                allNotifiedProviders: [providerId],
                expiresAt: new Date(Date.now() + 10000),
            };

            mockServiceRequestModel.findById.mockResolvedValue(mockRequest);

            await expect(service.accept('req123', providerId.toString())).rejects.toThrow(BadRequestException);
        });

        it('should return listing and pricing information', async () => {
            const providerId = new Types.ObjectId();
            const categoryId = new Types.ObjectId();
            const seekerId = new Types.ObjectId();
            const mockRequest = {
                _id: 'req123',
                status: ServiceRequestStatus.MATCHED,
                allNotifiedProviders: [providerId],
                expiresAt: new Date(Date.now() + 10000),
                categoryId: categoryId,
                subCategoryId: undefined,
                seekerId: seekerId,
                location: { coordinates: [77.5946, 12.9716] },
                serviceStartDate: new Date(),
                serviceEndDate: new Date(),
                description: 'Test service',
                metadata: { quantity: 2, duration: 3 },
                save: jest.fn().mockResolvedValue(true),
                toObject: jest.fn().mockReturnThis(),
            };

            const mockListing = {
                _id: new Types.ObjectId(),
                categoryId: categoryId,
                price: 100,
                isActive: true,
                unitOfMeasure: 'per_unit',
                title: 'Test Listing',
                providerId: { name: 'Test Provider' },
            };

            const mockOrder = {
                _id: 'order123',
                totalAmount: 200, // 100 * quantity(2)
            };

            // Mock the atomic update
            const updatedRequest = {
                ...mockRequest,
                acceptedProviderId: providerId,
                acceptedListingId: mockListing._id,
                status: ServiceRequestStatus.ACCEPTED,
                toObject: jest.fn().mockReturnValue({
                    ...mockRequest,
                    acceptedProviderId: providerId,
                    acceptedListingId: mockListing._id,
                }),
            };

            mockServiceRequestModel.findById.mockResolvedValue(mockRequest);
            mockListingsService.findByProvider.mockResolvedValue([mockListing]);
            mockServiceRequestModel.findOneAndUpdate.mockResolvedValue(updatedRequest);
            mockOrdersService.createFromServiceRequest.mockResolvedValue(mockOrder as any);

            const result = await service.accept('req123', providerId.toString());

            expect(result.request.acceptedProviderId?.toString()).toBe(providerId.toString());
            expect(result.request.acceptedListingId?.toString()).toBe(mockListing._id.toString());
            expect(result.order).toBeDefined();
            expect(mockOrdersService.createFromServiceRequest).toHaveBeenCalled();
            expect(mockNotificationService.notifySeekerAccepted).toHaveBeenCalled();
            expect(mockNotificationService.notifyProvidersClosed).toHaveBeenCalled();
        });
    });

    describe('decline', () => {
        it('should add provider to declined list', async () => {
            const providerId = new Types.ObjectId();
            const mockRequest = {
                _id: 'req123',
                allNotifiedProviders: [providerId],
                declinedProviders: [],
                save: jest.fn().mockResolvedValue(true),
            };

            mockServiceRequestModel.findById.mockResolvedValue(mockRequest);

            await service.decline('req123', providerId.toString(), 'Not available');

            expect(mockRequest.declinedProviders).toHaveLength(1);
            expect(mockRequest.save).toHaveBeenCalled();
        });

        it('should not duplicate declined provider', async () => {
            const providerId = new Types.ObjectId();
            const mockRequest = {
                _id: 'req123',
                allNotifiedProviders: [providerId],
                declinedProviders: [providerId],
                save: jest.fn().mockResolvedValue(true),
            };

            mockServiceRequestModel.findById.mockResolvedValue(mockRequest);

            await service.decline('req123', providerId.toString());

            expect(mockRequest.declinedProviders).toHaveLength(1);
            expect(mockRequest.save).not.toHaveBeenCalled();
        });
    });
});
