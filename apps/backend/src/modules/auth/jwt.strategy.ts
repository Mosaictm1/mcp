import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        // Supabase JWTs are signed with the JWT secret from project settings
        // The secret is in the format: your-super-secret-jwt-token-with-at-least-32-characters-long
        // For local JWT_SECRET we use that, but Supabase tokens need their own secret
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            // Use JWT_SECRET for local tokens
            // Supabase tokens are verified by the SupabaseService instead
            secretOrKey: configService.get('JWT_SECRET'),
        });
    }

    async validate(payload: any) {
        // Payload from Supabase JWT contains: sub (user id), email, role, etc.
        return {
            sub: payload.sub,
            email: payload.email,
            userId: payload.sub, // Alias for convenience
        };
    }
}
