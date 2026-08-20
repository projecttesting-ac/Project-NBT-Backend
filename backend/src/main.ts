// import { ValidationPipe } from '@nestjs/common';
// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   app.enableCors({
//     origin: '*',
//     credentials: true,
//   });

//   app.setGlobalPrefix('api');

//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       transform: true,
//       forbidNonWhitelisted: true,
//     }),
//   );

//   const port = Number(process.env.PORT) || 3000;

//   await app.listen(port);

//   console.log(`🚀 Server running on http://localhost:${port}/api`);
// }

// bootstrap();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';                                                                   
import { AppModule } from './app.module';

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('NBT Backend API')
    .setDescription('API documentation for the NBT Social Media Backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT) || 3000;

  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}/api`);
  console.log(`📚 Swagger Docs: http://localhost:${port}/docs`);
}

bootstrap();``