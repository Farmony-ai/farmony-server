import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WaveSchedulerService } from './wave-scheduler.service';
import { ServiceRequest } from '../schemas/service-request.entity';
import { MatchesOrchestratorService } from './matches-orchestrator.service';

describe('WaveSchedulerService', () => {
    let service: WaveSchedulerService;
    let mockServiceRequestModel: any;
    let mockMatchesOrchestratorService: jest.Mocked<MatchesOrchestratorService>;

    beforeEach(async () => {
        mockServiceRequestModel = {
            find: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            exec: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            countDocuments: jest.fn(),
        };

        mockMatchesOrchestratorService = {
            processNextWave: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WaveSchedulerService,
                {
                    provide: getModelToken(ServiceRequest.name),
                    useValue: mockServiceRequestModel,
                },
                {
                    provide: MatchesOrchestratorService,
                    useValue: mockMatchesOrchestratorService,
                },
            ],
        }).compile();

        service = module.get<WaveSchedulerService>(WaveSchedulerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('processScheduledWaves', () => {
        it('should process requests with scheduled waves', async () => {
            const mockRequests = [
                { _id: 'req1', currentWave: 1 },
                { _id: 'req2', currentWave: 2 },
            ];

            mockServiceRequestModel.exec.mockResolvedValue(mockRequests);
            mockMatchesOrchestratorService.processNextWave.mockResolvedValue({
                waveNumber: 2,
                providersNotified: 5,
                nextWaveScheduled: true,
            } as any);

            await service.processScheduledWaves();

            expect(mockServiceRequestModel.find).toHaveBeenCalled();
            expect(mockMatchesOrchestratorService.processNextWave).toHaveBeenCalledTimes(2);
            expect(mockMatchesOrchestratorService.processNextWave).toHaveBeenCalledWith('req1');
            expect(mockMatchesOrchestratorService.processNextWave).toHaveBeenCalledWith('req2');
        });

        it('should handle empty request list gracefully', async () => {
            mockServiceRequestModel.exec.mockResolvedValue([]);

            await service.processScheduledWaves();

            expect(mockServiceRequestModel.find).toHaveBeenCalled();
            expect(mockMatchesOrchestratorService.processNextWave).not.toHaveBeenCalled();
        });

        it('should continue processing if one request fails', async () => {
            const mockRequests = [
                { _id: 'req1', currentWave: 1 },
                { _id: 'req2', currentWave: 2 },
                { _id: 'req3', currentWave: 1 },
            ];

            mockServiceRequestModel.exec.mockResolvedValue(mockRequests);
            mockMatchesOrchestratorService.processNextWave
                .mockResolvedValueOnce({ waveNumber: 2, providersNotified: 5, nextWaveScheduled: true } as any)
                .mockRejectedValueOnce(new Error('Processing failed'))
                .mockResolvedValueOnce({ waveNumber: 2, providersNotified: 3, nextWaveScheduled: true } as any);

            await service.processScheduledWaves();

            expect(mockMatchesOrchestratorService.processNextWave).toHaveBeenCalledTimes(3);
        });

        it('should handle database errors gracefully', async () => {
            mockServiceRequestModel.exec.mockRejectedValue(new Error('Database error'));

            await expect(service.processScheduledWaves()).resolves.not.toThrow();
        });

        it('should limit processing to 10 requests at a time', async () => {
            await service.processScheduledWaves();

            expect(mockServiceRequestModel.limit).toHaveBeenCalledWith(10);
        });
    });

    describe('triggerWaveProcessing', () => {
        it('should manually trigger wave processing for a request', async () => {
            mockMatchesOrchestratorService.processNextWave.mockResolvedValue({
                waveNumber: 2,
                providersNotified: 5,
                nextWaveScheduled: true,
            } as any);

            await service.triggerWaveProcessing('req123');

            expect(mockMatchesOrchestratorService.processNextWave).toHaveBeenCalledWith('req123');
        });
    });
});
