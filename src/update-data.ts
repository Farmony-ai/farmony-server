import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConnectionToken } from '@nestjs/mongoose';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const connection = app.get(getConnectionToken());

    console.log('--- UPDATING DATA ---');

    // Update some requests to OPEN
    const result = await connection.collection('servicerequests').updateMany(
        { status: 'no_providers_available' },
        { $set: { status: 'OPEN' } }
    );

    console.log(`Updated ${result.modifiedCount} requests to OPEN status.`);

    await app.close();
    process.exit(0);
}

bootstrap();
