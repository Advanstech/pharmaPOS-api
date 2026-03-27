import { AuditService } from './audit.service';
import { AuditPeriodInput, DispensingComplianceAudit, FinancialIntegrityAudit, InventoryIntegrityAudit, InternalAuditReport, LicenceComplianceAudit, StaffBehaviourProfile, StaffInvestigationInput, TaxComplianceAudit } from './dto/audit.types';
interface AuthUser {
    id: string;
    role: string;
    branchId: string;
    organizationId: string;
}
export declare class AuditResolver {
    private readonly auditService;
    constructor(auditService: AuditService);
    internalAuditReport(input: AuditPeriodInput, user: AuthUser): Promise<InternalAuditReport>;
    dispensingComplianceAudit(input: AuditPeriodInput, user: AuthUser): Promise<DispensingComplianceAudit>;
    financialIntegrityAudit(input: AuditPeriodInput, user: AuthUser): Promise<FinancialIntegrityAudit>;
    inventoryIntegrityAudit(input: AuditPeriodInput, user: AuthUser): Promise<InventoryIntegrityAudit>;
    taxComplianceAudit(input: AuditPeriodInput, user: AuthUser): Promise<TaxComplianceAudit>;
    licenceComplianceAudit(user: AuthUser): Promise<LicenceComplianceAudit>;
    staffBehaviourProfiles(input: AuditPeriodInput, user: AuthUser): Promise<StaffBehaviourProfile[]>;
    staffBehaviourProfile(input: StaffInvestigationInput, branchId: string): Promise<StaffBehaviourProfile>;
}
export {};
