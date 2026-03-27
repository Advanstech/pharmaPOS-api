import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingService } from './accounting.service';
import { AccountingResolver } from './accounting.resolver';
import { FinancialIntelligenceService } from './financial-intelligence.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [AccountingService, FinancialIntelligenceService, AccountingResolver],
  exports: [AccountingService, FinancialIntelligenceService],
})
export class AccountingModule {}
