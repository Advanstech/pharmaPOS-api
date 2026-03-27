import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffService } from './staff.service';
import { StaffResolver } from './staff.resolver';
import { StaffProfile } from './entities/staff_profile.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // Reuse User entity + guards from AuthModule
    AuthModule,
    TypeOrmModule.forFeature([StaffProfile]),
  ],
  providers: [StaffService, StaffResolver],
  exports: [StaffService],
})
export class StaffModule {}
