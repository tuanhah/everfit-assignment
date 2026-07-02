import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { buildValidationPipe } from './common/validation.pipe-factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(buildValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  const openApiConfig = new DocumentBuilder()
    .setTitle('Everfit Workout Logging API')
    .setDescription(
      'Log workouts, browse filtered history and track personal records. ' +
        'No authentication — pass userId as a parameter (per assignment).',
    )
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, openApiConfig),
  );

  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
