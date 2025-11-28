
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ProvidersService } from './modules/dashboard/providers/providers.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const providersService = app.get(ProvidersService);

    const providerId = '691811021f81ad547ff5ac89';
    console.log(`Calling getProviderDashboard for provider: ${providerId}`);

    try {
        const dashboard = await providersService.getProviderDashboard(providerId);

        console.log('\n--- Dashboard Summary ---');
        console.log(JSON.stringify(dashboard.summary, null, 2));

        console.log('\n--- Available Service Requests ---');
        console.log(JSON.stringify(dashboard.availableServiceRequests, null, 2));

        if (dashboard.availableServiceRequests.length > 0) {
            console.log('\nSUCCESS: Service request found in dashboard!');
        } else {
            console.log('\nFAILURE: No service requests found in dashboard.');
        }

    } catch (error) {
        console.error('Error calling getProviderDashboard:', error);
    }

    await app.close();
}

bootstrap();
