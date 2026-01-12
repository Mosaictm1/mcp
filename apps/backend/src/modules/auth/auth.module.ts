import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [
        PrismaModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get('JWT_EXPIRES_IN', '7d'),
                },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, SupabaseService, SupabaseAuthGuard],
    exports: [AuthService, SupabaseService, SupabaseAuthGuard],
})
export class AuthModule { }

