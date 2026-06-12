import { NestFactory, Reflector } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RolesGuard, PermissionsGuard, TenantGuard } from './common/guards';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const reflector = app.get(Reflector);

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:5174'];

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(createValidationPipe());

  app.useGlobalGuards(
    new TenantGuard(reflector),
    new RolesGuard(reflector),
    new PermissionsGuard(reflector),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('车店云管家 API')
    .setDescription('SaaS 多商户汽服门店管理系统')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_PORT || 3000;
  const host = process.env.API_HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`API server running on http://${host}:${port}`);
  console.log(`Swagger docs at http://${host}:${port}/api/docs`);
}

bootstrap();
