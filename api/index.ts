import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';

let app: any;
let server: any;

async function bootstrap() {
  if (!app) {
    // Create a simple Express instance
    const express = require('express');
    server = express();
    
    const adapter = new ExpressAdapter(server);
    app = await NestFactory.create(AppModule, adapter, { logger: ['error'] });
    app.enableCors({
      origin: true,
      credentials: true,
    });
    app.setGlobalPrefix('api');
    await app.init();
  }
  return app;
}

export default async function handler(req: any, res: any) {
  await bootstrap();
  server(req, res);
}
