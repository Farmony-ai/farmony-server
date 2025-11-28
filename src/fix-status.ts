import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConnectionToken } from '@nestjs/mongoose';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const connection = app.get(getConnectionToken());

    console.log('--- FIXING STATUS CASE ---');

    // Update OPEN to open
    const resultOpen = await connection.collection('servicerequests').updateMany(
        { status: 'OPEN' },
        { $set: { status: 'open' } }
    );
    console.log(`Updated ${resultOpen.modifiedCount} requests from OPEN to open.`);

    // Update MATCHED to matched
    const resultMatched = await connection.collection('servicerequests').updateMany(
        { status: 'MATCHED' },
        { $set: { status: 'matched' } }
    );
    console.log(`Updated ${resultMatched.modifiedCount} requests from MATCHED to matched.`);

    await app.close();
    process.exit(0);
}

bootstrap();
