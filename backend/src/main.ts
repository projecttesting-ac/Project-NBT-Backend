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

<<<<<<< HEAD
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';                                                                   
=======

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
>>>>>>> origin/raza
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

<<<<<<< HEAD
  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('NBT Backend API')
    .setDescription('API documentation for the NBT Social Media Backend')
    .setVersion('1.0')
    .addBearerAuth()
=======
  const config = new DocumentBuilder()
    .setTitle('Project NBT API')
    .setDescription('Project NBT Backend API')
    .setVersion('1.0')
>>>>>>> origin/raza
    .build();

  const document = SwaggerModule.createDocument(app, config);

<<<<<<< HEAD
  SwaggerModule.setup('docs', app, document);
=======
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });
>>>>>>> origin/raza

  const port = Number(process.env.PORT) || 3000;

  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}/api`);
<<<<<<< HEAD
  console.log(`📚 Swagger Docs: http://localhost:${port}/docs`);
=======
  console.log(`📚 Swagger running on http://localhost:${port}/api/docs`);
>>>>>>> origin/raza
}

bootstrap();``