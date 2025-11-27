import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  dotenv.config();
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  app.enableCors({
    origin: '*',
  });
  
  app.setGlobalPrefix('api');
  
  // Setup Swagger ONLY in development for now
  if (process.env.ENABLE_SWAGGER === 'true') {
    setupSwagger(app);
    console.log(`📚 Swagger docs: http://localhost:${process.env.PORT}/api/docs`);
  }
  
  await app.listen(process.env.PORT || 3000);
  console.log(`Server listening on port ${process.env.PORT || 3000}`);
}
bootstrap();