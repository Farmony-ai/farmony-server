import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ServiceRequest, ServiceRequestDocument, ServiceRequestStatus } from '../../../transactions/service-requests/schemas/service-request.entity';
import { MatchesOrchestratorService } from './matches-orchestrator.service';
import { WAVE_CONFIG } from '../../../common/config/waves.config';

/**
 * WaveSchedulerService manages cron-based scheduling of wave processing and request expiration
 * Isolates scheduling logic from business logic for better testability
 */
@Injectable()
export class WaveSchedulerService {
    private readonly logger = new Logger(WaveSchedulerService.name);

    constructor(
        @InjectModel(ServiceRequest.name)
        private readonly serviceRequestModel: Model<ServiceRequestDocument>,
        private readonly matchesOrchestratorService: MatchesOrchestratorService
    ) {}

    /**
     * Cron job to process scheduled waves
     * Runs every minute to check for requests needing wave processing
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async processScheduledWaves(): Promise<void> {
        const now = new Date();

        try {
            const requestsNeedingWave = await this.serviceRequestModel
                .find({
                    status: { $in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.MATCHED] },
                    $and: [
                        { $or: [ { 'lifecycle.matching.nextWaveAt': { $lte: now } }, { nextWaveAt: { $lte: now } } ] },
                        { $or: [ { 'lifecycle.matching.currentWave': { $lt: WAVE_CONFIG.maxWaves } }, { currentWave: { $lt: WAVE_CONFIG.maxWaves } } ] },
                    ],
                })
                .limit(10) // Process 10 at a time to avoid overwhelming the system
                .exec();

            if (requestsNeedingWave.length > 0) {
                this.logger.log(`Processing ${requestsNeedingWave.length} scheduled waves`);
            }

            for (const request of requestsNeedingWave) {
                try {
                    await this.matchesOrchestratorService.processNextWave(request._id);
                } catch (error) {
                    this.logger.error(`Error processing wave for request ${request._id}:`, error);
                    // Continue processing other requests even if one fails
                }
            }
        } catch (error) {
            this.logger.error('Error in processScheduledWaves cron job:', error);
        }
    }

    /**
     * Manually trigger wave processing for a specific request (for testing/admin)
     */
    async triggerWaveProcessing(requestId: string): Promise<void> {
        this.logger.log(`Manually triggering wave processing for request ${requestId}`);
        await this.matchesOrchestratorService.processNextWave(requestId);
    }
}
