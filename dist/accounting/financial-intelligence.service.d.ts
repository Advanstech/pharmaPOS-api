import { DataSource } from 'typeorm';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';
import { WorkingCapitalReport, InventoryFinancialMetrics, SupplierScorecard, ProductProfitability, RevenueIntelligence, PayrollAnalytics, VatComplianceReport, InvestmentIntelligenceReport, CfoBriefing } from './dto/financial-intelligence.types';
export declare class FinancialIntelligenceService {
    private readonly dataSource;
    private readonly effectiveSaleAt;
    private readonly logger;
    constructor(dataSource: DataSource, effectiveSaleAt: SalesEffectiveAtService);
    getCfoBriefing(branchId: string): Promise<CfoBriefing>;
    getWorkingCapital(branchId: string): Promise<WorkingCapitalReport & {
        cashRunwayDays: number;
    }>;
    getInventoryFinancialMetrics(branchId: string): Promise<InventoryFinancialMetrics>;
    getRevenueIntelligence(branchId: string): Promise<RevenueIntelligence>;
    getPayrollAnalytics(branchId: string, periodStart: string, periodEnd: string): Promise<PayrollAnalytics>;
    getVatCompliance(branchId: string, year: number, month: number): Promise<VatComplianceReport>;
    getTopSupplierScorecards(branchId: string, limit: number): Promise<SupplierScorecard[]>;
    getTopProductProfitability(branchId: string, periodStart: string, periodEnd: string, limit: number): Promise<ProductProfitability[]>;
    getInvestmentIntelligence(branchId: string, netMarginPct: number, cashRunwayDays: number, netProfitPesewas: number, cmgr6Month: number): Promise<InvestmentIntelligenceReport>;
    private buildAlerts;
    private buildKeyRatios;
    private scoreHealth;
    private buildExecutiveSummary;
    private getCurrentCash;
    private getTotalPayables;
    private getBranchName;
    private getMonthPL;
    private linearRegressionNextValue;
    private buildRevenueInsight;
    private fmt;
    private fmtGhs;
}
