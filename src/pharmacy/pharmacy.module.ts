import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PharmacyService } from './pharmacy.service';
import { PharmacyResolver } from './pharmacy.resolver';
import { PrescriptionWebhookController } from './prescription-webhook.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    // Redis-backed cache for GMDC licence validation (24h TTL)
    CacheModule.register({ ttl: 86_400 }),
  ],
  controllers: [PrescriptionWebhookController],
  providers: [PharmacyService, PharmacyResolver],
  exports: [PharmacyService],
})
export class PharmacyModule {}
