import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Security
    app.use(helmet());

    // CORS - Allow frontend and Pica AuthKit
    const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'https://authkit.picaos.com',
        'https://picaos.com',
    ];

    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps, curl, etc)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });

    // Validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // API prefix
    app.setGlobalPrefix('api');

    // Swagger
    if (process.env.NODE_ENV !== 'production') {
        const config = new DocumentBuilder()
            .setTitle('n8n Autopilot API')
            .setDescription('MCP-based SaaS for automated n8n workflow creation')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('docs', app, document);
    }

    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🚀 n8n Autopilot API running on port ${port}`);
}

bootstrap();
