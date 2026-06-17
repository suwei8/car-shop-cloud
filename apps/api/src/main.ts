import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';

// Node 18 on Alpine does not expose Web Crypto on globalThis; @nestjs/schedule
// (and other libs) call crypto.randomUUID() and crash. Shim it once at boot.
// Safe on Node 19+ where globalThis.crypto is already defined.
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (globalThis as any).crypto = require('node:crypto').webcrypto;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // ---------------------------------------------------------------------------
  // CORS — whitelist from CORS_ORIGINS (new) or CORS_ORIGIN (legacy).
  // Falls back to localhost dev origins when neither is set.
  // ---------------------------------------------------------------------------
  const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0) {
    corsOrigins.push('http://localhost:5173', 'http://localhost:5174');
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow same-origin / server-to-server requests (no Origin header)
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ---------------------------------------------------------------------------
  // Helmet — standard web security headers.
  // Swagger UI uses inline script/style, so CSP must be relaxed on /api/docs.
  // ---------------------------------------------------------------------------
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/docs')) {
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      })(req, res, next);
    } else {
      helmet()(req, res, next);
    }
  });

  app.useGlobalPipes(createValidationPipe());

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
  // Default 0.0.0.0 so the API is reachable from outside the container
  // (e.g., Nginx reverse proxy). Override via API_HOST in .env for local dev.
  const host = process.env.API_HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`API server running on http://${host}:${port}`);
  console.log(`Swagger docs at http://${host}:${port}/api/docs`);
}

bootstrap();
