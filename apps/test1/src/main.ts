import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

import { instrumentation1 } from 'instrumentation';

async function bootstrap() {
  instrumentation1.startTracingSDK({
    serviceName: 'test1',
    otelReceiverEndpoint: process.env.OTEL_RECEIVER_ENDPOINT,
  })

  const app = await NestFactory.create(AppModule);
  
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}`);
}

bootstrap();
