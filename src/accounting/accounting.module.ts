import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingService } from './accounting.service';
import { AccountingResolver } from './accounting.resolver';
import { FinancialIntelligenceService } from './financial-intelligence.service';
import { ExpenseService } from './expense.service';
import { ExpenseResolver } from './expense.resolver';
import { GLPostingService } from './gl-posting.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [TypeOrmModule.forFeature([]), ReportsModule],
  providers: [
    AccountingService,
    FinancialIntelligenceService,
    AccountingResolver,
    ExpenseService,
    ExpenseResolver,
    GLPostingService,
  ],
  exports: [AccountingService, FinancialIntelligenceService, ExpenseService, GLPostingService],
})
export class AccountingModule {}
