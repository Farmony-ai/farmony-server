import { Module } from '@nestjs/common';
import { ServiceRequestsModule } from './service-requests/service-requests.module';

/**
 * Transactions Module - Money Flow Domain
 *
 * Aggregates all transaction-related functionality:
 * - Service Requests: Main workflow (contains entire lifecycle)
 * - Payments: Future - Payment processing
 * - Disputes: Future - Dispute resolution
 */
@Module({
    imports: [
        ServiceRequestsModule,
    ],
    exports: [
        ServiceRequestsModule,
    ],
})
export class TransactionsModule {}
