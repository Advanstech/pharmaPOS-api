import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

/**
 * Global Supabase admin client — uses service_role key (bypasses RLS).
 * Use ONLY for server-side admin operations: Storage uploads, seeding.
 * Never expose service_role key to the web client.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SupabaseClient => {
        const url = config.getOrThrow<string>('SUPABASE_URL');
        const key = config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
        return createClient(url, key, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      },
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
