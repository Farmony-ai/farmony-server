import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequest } from './entities/service-request.entity';
import { MatchesService } from '../matches/matches.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { ChatGateway } from '../chat/chat.gateway';

describe('ServiceRequestsService', () => {
  let service: ServiceRequestsService;

  const mockServiceRequestModel = {
    new: jest.fn(),
    constructor: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    countDocuments: jest.fn(),
    save: jest.fn(),
  };

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceRequestsService,
        {
          provide: getModelToken(ServiceRequest.name),
          useValue: mockServiceRequestModel,
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
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ChatGateway,
          useValue: mockChatGateway,
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
        location: { lat: 28.6139, lon: 77.2090 },
        serviceStartDate: new Date('2024-10-15'),
        serviceEndDate: new Date('2024-10-16'),
      };

      const mockMatchResult = {
        request_id: 'match-123',
        providers: [
          { _id: 'provider1', name: 'Provider 1', distance_m: 1000 },
          { _id: 'provider2', name: 'Provider 2', distance_m: 2000 },
        ],
        status: 'CREATED',
      };

      mockMatchesService.createMatch.mockResolvedValue(mockMatchResult);

      const mockSave = jest.fn().mockResolvedValue({
        _id: 'request-123',
        ...createDto,
        matchRequestId: 'match-123',
        matchedProviderIds: ['provider1', 'provider2'],
        status: 'MATCHED',
      });

      mockServiceRequestModel.new.mockImplementation(() => ({
        save: mockSave,
      }));

      const result = await service.create(createDto as any, 'seeker-123');

      expect(mockMatchesService.createMatch).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('accept', () => {
    it('should only allow matched providers to accept', async () => {
      const requestId = 'request-123';
      const providerId = 'provider-123';
      const acceptDto = {
        price: 3500,
        message: 'I can help',
      };

      const mockRequest = {
        _id: requestId,
        matchedProviderIds: ['provider-456'],
        status: 'MATCHED',
        seekerId: 'seeker-123',
      };

      mockServiceRequestModel.findById.mockResolvedValue(mockRequest);

      await expect(
        service.accept(requestId, providerId, acceptDto as any),
      ).rejects.toThrow('You are not authorized to accept this request');
    });
  });

  describe('findAvailableForProvider', () => {
    it('should only return requests where provider is matched', async () => {
      const providerId = '507f1f77bcf86cd799439011';

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: 'request-1',
            title: 'Request 1',
            matchedProviderIds: [providerId, 'provider-456'],
          },
        ]),
      };

      mockServiceRequestModel.find.mockReturnValue(mockQuery);
      mockServiceRequestModel.countDocuments.mockResolvedValue(1);
      mockServiceRequestModel.updateMany.mockResolvedValue({});

      const result = await service.findAvailableForProvider(providerId, {});

      expect(mockServiceRequestModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          matchedProviderIds: expect.any(Object),
        }),
      );
      expect(result.requests).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});