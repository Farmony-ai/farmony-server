// src/config/swagger.config.ts
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Rural Share API')
    .setDescription('Platform connecting rural service providers with seekers')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Listings', 'Service listings')
    .addTag('Orders', 'Order management')
    .addTag('Escrow', 'Payment escrow')
    .addTag('Addresses', 'Address management')
    .addTag('Catalogue', 'Categories')
    .addTag('Providers', 'Provider dashboard')
    .addTag('Ratings', 'Reviews and ratings')
    .addTag('Messages', 'Notifications')
    .addTag('Disputes', 'Dispute resolution')
    .addTag('KYC', 'KYC documents')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}