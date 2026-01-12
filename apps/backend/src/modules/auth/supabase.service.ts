import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
    private supabase: SupabaseClient;

    constructor(private configService: ConfigService) {
        this.supabase = createClient(
            this.configService.get('SUPABASE_URL')!,
            this.configService.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
    }

    getClient(): SupabaseClient {
        return this.supabase;
    }

    async verifyToken(token: string) {
        const { data, error } = await this.supabase.auth.getUser(token);
        if (error) throw error;
        return data.user;
    }
}
