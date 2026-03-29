import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffService } from './staff.service';
import { StaffResolver } from './staff.resolver';
import { User } from '../auth/entities/user.entity';
import { StaffProfile } from './entities/staff_profile.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, StaffProfile]),
    NotificationsModule,
    ConfigModule,
  ],
  providers: [StaffService, StaffResolver],
  exports: [StaffService],
})
export class StaffModule {}
