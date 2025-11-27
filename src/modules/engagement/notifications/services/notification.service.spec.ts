import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { ChatGateway } from '../../modules/chat/chat.gateway';

describe('NotificationService', () => {
  let service: NotificationService;
  let chatGateway: jest.Mocked<ChatGateway>;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: ChatGateway,
          useValue: {
            server: mockServer,
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    chatGateway = module.get(ChatGateway) as jest.Mocked<ChatGateway>;

    // Reset mocks
    mockServer.to.mockClear();
    mockServer.emit.mockClear();
    mockServer.to.mockReturnValue(mockServer);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notifyProvidersNewRequest', () => {
    it('should notify all providers about new request', async () => {
      const providerIds = ['provider1', 'provider2'];
      const payload = {
        requestId: 'req123',
        title: 'Test Request',
        description: 'Test description',
        categoryName: 'Category',
        distanceKm: 5,
        serviceStartDate: new Date(),
        serviceEndDate: new Date(),
      };

      await service.notifyProvidersNewRequest('req123', providerIds, payload);

      expect(mockServer.to).toHaveBeenCalledTimes(2);
      expect(mockServer.to).toHaveBeenCalledWith('user-provider1');
      expect(mockServer.to).toHaveBeenCalledWith('user-provider2');
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenCalledWith('service-request-new-opportunity', payload);
    });

    it('should handle empty provider list gracefully', async () => {
      const payload = {
        requestId: 'req123',
        title: 'Test Request',
        description: 'Test description',
        categoryName: 'Category',
        distanceKm: 5,
        serviceStartDate: new Date(),
        serviceEndDate: new Date(),
      };

      await service.notifyProvidersNewRequest('req123', [], payload);

      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });

    it('should continue notifying other providers if one fails', async () => {
      const providerIds = ['provider1', 'provider2'];
      const payload = {
        requestId: 'req123',
        title: 'Test Request',
        description: 'Test description',
        categoryName: 'Category',
        distanceKm: 5,
        serviceStartDate: new Date(),
        serviceEndDate: new Date(),
      };

      mockServer.emit
        .mockImplementationOnce(() => { throw new Error('Socket error'); })
        .mockImplementationOnce(() => {});

      await service.notifyProvidersNewRequest('req123', providerIds, payload);

      expect(mockServer.to).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('notifySeekerAccepted', () => {
    it('should notify seeker about acceptance', async () => {
      const payload = {
        requestId: 'req123',
        providerId: 'provider1',
        providerName: 'John Doe',
        orderId: 'order123',
        totalAmount: 1000,
      };

      await service.notifySeekerAccepted('seeker1', payload);

      expect(mockServer.to).toHaveBeenCalledWith('user-seeker1');
      expect(mockServer.emit).toHaveBeenCalledWith('service-request-accepted', payload);
    });

    it('should handle socket errors gracefully', async () => {
      const payload = {
        requestId: 'req123',
        providerId: 'provider1',
        providerName: 'John Doe',
        orderId: 'order123',
        totalAmount: 1000,
      };

      mockServer.emit.mockImplementationOnce(() => { throw new Error('Socket error'); });

      await expect(service.notifySeekerAccepted('seeker1', payload)).resolves.not.toThrow();
    });
  });

  describe('notifyProvidersClosed', () => {
    it('should notify providers about request closure', async () => {
      const providerIds = ['provider1', 'provider2'];

      await service.notifyProvidersClosed(providerIds, 'req123', 'expired');

      expect(mockServer.to).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenCalledWith('service-request-closed', {
        requestId: 'req123',
        reason: 'expired',
      });
    });

    it('should handle different closure reasons', async () => {
      const providerIds = ['provider1'];

      await service.notifyProvidersClosed(providerIds, 'req123', 'accepted_by_another');

      expect(mockServer.emit).toHaveBeenCalledWith('service-request-closed', {
        requestId: 'req123',
        reason: 'accepted_by_another',
      });
    });

    it('should handle empty provider list', async () => {
      await service.notifyProvidersClosed([], 'req123', 'cancelled');

      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('notifySeekerNoProviders', () => {
    it('should notify seeker when no providers available', async () => {
      await service.notifySeekerNoProviders('seeker1', 'req123');

      expect(mockServer.to).toHaveBeenCalledWith('user-seeker1');
      expect(mockServer.emit).toHaveBeenCalledWith('service-request-no-providers', {
        requestId: 'req123',
        message: expect.any(String),
      });
    });
  });

  describe('notifySeekerExpired', () => {
    it('should notify seeker about expiration', async () => {
      await service.notifySeekerExpired('seeker1', 'req123');

      expect(mockServer.to).toHaveBeenCalledWith('user-seeker1');
      expect(mockServer.emit).toHaveBeenCalledWith('service-request-expired', {
        requestId: 'req123',
        message: expect.any(String),
      });
    });
  });
});
