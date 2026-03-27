import { DataSource } from 'typeorm';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';
import { AuditFinding, AuditPeriodInput, DispensingComplianceAudit, FinancialIntegrityAudit, InventoryIntegrityAudit, InternalAuditReport, LicenceComplianceAudit, RiskMatrixEntry, StaffBehaviourProfile, StaffInvestigationInput, TaxComplianceAudit } from './dto/audit.types';
export declare class AuditService {
    private readonly dataSource;
    private readonly effectiveSaleAt;
    private readonly logger;
    constructor(dataSource: DataSource, effectiveSaleAt: SalesEffectiveAtService);
    getInternalAuditReport(branchId: string, input: AuditPeriodInput): Promise<InternalAuditReport>;
    getDispensingComplianceAudit(branchId: string, input: AuditPeriodInput): Promise<DispensingComplianceAudit>;
    getFinancialIntegrityAudit(branchId: string, input: AuditPeriodInput): Promise<FinancialIntegrityAudit>;
    getInventoryIntegrityAudit(branchId: string, input: AuditPeriodInput): Promise<InventoryIntegrityAudit>;
    getTaxComplianceAudit(branchId: string, input: AuditPeriodInput): Promise<TaxComplianceAudit>;
    getLicenceComplianceAudit(branchId: string): Promise<LicenceComplianceAudit>;
    getStaffBehaviourProfiles(branchId: string, input: AuditPeriodInput): Promise<StaffBehaviourProfile[]>;
    getStaffBehaviourProfile(branchId: string, input: StaffInvestigationInput): Promise<StaffBehaviourProfile>;
    buildRiskMatrix(findings: AuditFinding[]): RiskMatrixEntry[];
    scoreOverallRisk(sections: {
        dispensingCompliance: DispensingComplianceAudit;
        financialIntegrity: FinancialIntegrityAudit;
        inventoryIntegrity: InventoryIntegrityAudit;
        taxCompliance: TaxComplianceAudit;
        licenceCompliance: LicenceComplianceAudit;
        staffProfiles: StaffBehaviourProfile[];
    }): number;
    buildAuditorOpinion(riskScore: number, criticalCount: number, findings: AuditFinding[]): {
        auditorOpinion: string;
        opinionNarrative: string;
        immediateActionPlan: string;
    };
    private finding;
    private buildStaffSummary;
    private riskRating;
    private severityWeight;
    private getBranchName;
    private fmt;
}
