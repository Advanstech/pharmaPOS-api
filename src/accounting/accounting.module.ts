import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingService } from './accounting.service';
import { AccountingResolver } from './accounting.resolver';
import { FinancialIntelligenceService } from './financial-intelligence.service';
import { ExpenseService } from './expense.service';
import { ExpenseResolver } from './expense.resolver';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [TypeOrmModule.forFeature([]), ReportsModule],
  providers: [
    AccountingService,
    FinancialIntelligenceService,
    AccountingResolver,
    ExpenseService,
    ExpenseResolver,
  ],
  exports: [AccountingService, FinancialIntelligenceService, ExpenseService],
})
export class AccountingModule {}
