import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ServiceRequestsService } from './modules/transactions/service-requests/services/service-requests.service';
import { UsersService } from './modules/identity/services/users.service';
import { getConnectionToken } from '@nestjs/mongoose';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const serviceRequestsService = app.get(ServiceRequestsService);
    const usersService = app.get(UsersService);
    const connection = app.get(getConnectionToken());

    console.log('--- DEBUGGING DATA ---');

    // Check Users
    const users = await connection.collection('users').find({}).toArray();
    console.log(`Total Users: ${users.length}`);
    const providers = users.filter(u => u.role === 'provider' || u.role === 'individual' || u.role === 'SHG' || u.role === 'FPO');
    console.log(`Total Providers: ${providers.length}`);

    const providersWithLocation = providers.filter(p => p.addresses && p.addresses.some(a => a.location && a.location.coordinates));
    console.log(`Providers with Location: ${providersWithLocation.length}`);

    if (providersWithLocation.length > 0) {
        console.log('Sample Provider Location:', JSON.stringify(providersWithLocation[0].addresses[0].location, null, 2));
        console.log('Provider Roles:', providersWithLocation.map(p => p.role));
    }

    // Check Service Requests
    const requests = await connection.collection('servicerequests').find({}).toArray();
    console.log(`Total Service Requests: ${requests.length}`);

    const requestsWithLocation = requests.filter(r => r.location && r.location.coordinates);
    console.log(`Requests with Location: ${requestsWithLocation.length}`);

    if (requestsWithLocation.length > 0) {
        console.log('Sample Request Location:', JSON.stringify(requestsWithLocation[0].location, null, 2));
        console.log('Request Statuses:', requestsWithLocation.map(r => r.status));
        console.log('Request Expiry Samples:', requestsWithLocation.slice(0, 5).map(r => r.expiresAt));
    }

    await app.close();
    process.exit(0);
}

bootstrap();
