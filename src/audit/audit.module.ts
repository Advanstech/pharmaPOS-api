import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditService } from './audit.service';
import { AuditResolver } from './audit.resolver';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([])],
  providers: [AuditService, AuditResolver],
  exports: [AuditService],
})
export class AuditModule {}
