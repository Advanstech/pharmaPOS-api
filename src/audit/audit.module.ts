import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditService } from './audit.service';
import { AuditResolver } from './audit.resolver';
import { ActivityTrackingInterceptor } from './activity-tracking.interceptor';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([])],
  providers: [
    AuditService,
    AuditResolver,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityTrackingInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
