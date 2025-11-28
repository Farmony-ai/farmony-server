import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConnectionToken } from '@nestjs/mongoose';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const connection = app.get(getConnectionToken());

    console.log('--- DEBUGGING SPECIFIC REQUEST ---');
    const requestId = "7ddabbae-4814-4dbc-947f-013a2ab1b44f";

    // Try to find by string ID or ObjectId
    let request = await connection.collection('servicerequests').findOne({ _id: requestId });
    if (!request) {
        try {
            const { ObjectId } = require('mongodb');
            request = await connection.collection('servicerequests').findOne({ _id: new ObjectId(requestId) });
        } catch (e) {
            console.log('Invalid ObjectId format');
        }
    }

    if (request) {
        console.log('Request Found:', JSON.stringify(request, null, 2));
    } else {
        console.log('Request NOT Found with ID:', requestId);
        // List all IDs to see if it's there under a different format
        const all = await connection.collection('servicerequests').find({}).project({ _id: 1 }).toArray();
        console.log('Available IDs:', all.map(d => d._id));
    }

    await app.close();
    process.exit(0);
}

bootstrap();
