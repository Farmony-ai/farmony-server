import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ServiceRequestsService } from '../service-requests/service-requests.service';
import { ServiceRequest } from '../schemas/service-request.entity';
import { MatchesService } from '../matches/matches.service';
import { OrdersService } from './orders.service';
import { UsersService } from '../users/users.service';
import { ChatGateway } from '../chat/chat.gateway';
import { ListingsService } from '../listings/listings.service';
import { AddressesService } from '../addresses/addresses.service';
import { AddressResolverService } from '../../common/services/address-resolver.service';
import { NotificationService } from '../../common/services/notification.service';
import { MatchesOrchestratorService } from './matches-orchestrator.service';

describe('ServiceRequestsService', () => {
    let service: ServiceRequestsService;

    // Create a mock save function
    const mockSave = jest.fn();

    // Mock model constructor
    const mockServiceRequestModel: any = jest.fn().mockImplementation(() => ({
        save: mockSave,
    }));

    // Add static methods to the mock
    mockServiceRequestModel.find = jest.fn();
    mockServiceRequestModel.findOne = jest.fn();
    mockServiceRequestModel.findById = jest.fn();
    mockServiceRequestModel.findByIdAndUpdate = jest.fn();
    mockServiceRequestModel.findOneAndUpdate = jest.fn();
    mockServiceRequestModel.updateMany = jest.fn();
    mockServiceRequestModel.countDocuments = jest.fn();

    const mockMatchesService = {
        createMatch: jest.fn(),
    };

    const mockOrdersService = {
        createFromServiceRequest: jest.fn(),
    };

    const mockUsersService = {
        findById: jest.fn(),
    };

    const mockChatGateway = {
        server: {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        },
    };

    const mockListingsService = {
        findByProvider: jest.fn(),
    };

    const mockAddressesService = {
        getValidatedAddress: jest.fn(),
        updateUsage: jest.fn(),
    };

    const mockAddressResolverService = {
        resolveForServiceRequestCreate: jest.fn(),
        resolveForServiceRequestUpdate: jest.fn(),
    };

    const mockNotificationService = {
        notifyProvidersNewRequest: jest.fn(),
        notifySeekerAccepted: jest.fn(),
        notifyProvidersClosed: jest.fn(),
        notifySeekerExpired: jest.fn(),
        notifySeekerNoProviders: jest.fn(),
    };

    const mockMatchesOrchestratorService = {
        startForRequest: jest.fn(),
        processNextWave: jest.fn(),
        accept: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ServiceRequestsService,
                {
                    provide: getModelToken(ServiceRequest.name),
                    useValue: mockServiceRequestModel,
                },
                {
                    provide: ListingsService,
                    useValue: mockListingsService,
                },
                {
                    provide: MatchesService,
                    useValue: mockMatchesService,
                },
                {
                    provide: OrdersService,
                    useValue: mockOrdersService,
                },
                {
                    provide: AddressesService,
                    useValue: mockAddressesService,
                },
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
                {
                    provide: ChatGateway,
                    useValue: mockChatGateway,
                },
                {
                    provide: AddressResolverService,
                    useValue: mockAddressResolverService,
                },
                {
                    provide: NotificationService,
                    useValue: mockNotificationService,
                },
                {
                    provide: MatchesOrchestratorService,
                    useValue: mockMatchesOrchestratorService,
                },
            ],
        }).compile();

        service = module.get<ServiceRequestsService>(ServiceRequestsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a service request and trigger matching', async () => {
            const createDto = {
                categoryId: '507f1f77bcf86cd799439011',
                title: 'Test Request',
                description: 'Test Description',
                location: { lat: 28.6139, lon: 77.209 },
                serviceStartDate: new Date('2024-10-15'),
                serviceEndDate: new Date('2024-10-16'),
            };

            // Mock AddressResolverService response
            mockAddressResolverService.resolveForServiceRequestCreate.mockResolvedValue({
                serviceAddressId: '507f1f77bcf86cd799439022', // Valid ObjectId format
                coordinates: [77.209, 28.6139] as [number, number],
            });

            const mockMatchResult = {
                request_id: 'match-123',
                providers: [
                    { _id: 'provider1', name: 'Provider 1', distance_m: 1000 },
                    { _id: 'provider2', name: 'Provider 2', distance_m: 2000 },
                ],
                status: 'CREATED',
            };

            mockMatchesService.createMatch.mockResolvedValue(mockMatchResult);

            // Reset and configure the save mock for this test
            mockSave.mockClear();
            mockSave.mockResolvedValue({
                _id: 'request-123',
                ...createDto,
                matchRequestId: 'match-123',
                matchedProviderIds: ['provider1', 'provider2'],
                status: 'MATCHED',
            });

            // Mock the orchestrator's startForRequest method
            const mockSavedRequest = {
                _id: 'request-123',
                ...createDto,
                status: 'OPEN',
                save: jest.fn(),
            };
            mockMatchesOrchestratorService.startForRequest.mockResolvedValue(undefined);

            // Use a valid ObjectId format for seekerId
            const result = await service.create(createDto as any, '507f1f77bcf86cd799439011');

            expect(mockAddressResolverService.resolveForServiceRequestCreate).toHaveBeenCalledWith('507f1f77bcf86cd799439011', createDto);
            expect(mockSave).toHaveBeenCalled();
            expect(mockMatchesOrchestratorService.startForRequest).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });

    describe('accept', () => {
        it('should delegate to MatchesOrchestratorService', async () => {
            const requestId = 'request-123';
            const providerId = 'provider-123';
            const acceptDto = {
                price: 3500,
                message: 'I can help',
            };

            const mockResult = {
                request: {
                    _id: requestId,
                    status: 'ACCEPTED',
                    acceptedProviderId: providerId,
                },
                order: {
                    _id: 'order-123',
                    totalAmount: 3500,
                },
            };

            mockMatchesOrchestratorService.accept.mockResolvedValue(mockResult);

            const result = await service.accept(requestId, providerId, acceptDto as any);

            expect(mockMatchesOrchestratorService.accept).toHaveBeenCalledWith(requestId, providerId);
            expect(result).toEqual(mockResult);
        });
    });

    // TODO: Re-implement or remove this test - method was removed during refactoring
    // describe('findAvailableForProvider', () => {
    //   it('should only return requests where provider is matched', async () => {
    //     const providerId = '507f1f77bcf86cd799439011';

    //     const mockQuery = {
    //       populate: jest.fn().mockReturnThis(),
    //       sort: jest.fn().mockReturnThis(),
    //       skip: jest.fn().mockReturnThis(),
    //       limit: jest.fn().mockReturnThis(),
    //       lean: jest.fn().mockResolvedValue([
    //         {
    //           _id: 'request-1',
    //           title: 'Request 1',
    //           matchedProviderIds: [providerId, 'provider-456'],
    //         },
    //       ]),
    //     };

    //     mockServiceRequestModel.find.mockReturnValue(mockQuery);
    //     mockServiceRequestModel.countDocuments.mockResolvedValue(1);
    //     mockServiceRequestModel.updateMany.mockResolvedValue({});

    //     const result = await service.findAvailableForProvider(providerId, {});

    //     expect(mockServiceRequestModel.find).toHaveBeenCalledWith(
    //       expect.objectContaining({
    //         matchedProviderIds: expect.any(Object),
    //       }),
    //     );
    //     expect(result.requests).toHaveLength(1);
    //     expect(result.total).toBe(1);
    //   });
    // });
});
