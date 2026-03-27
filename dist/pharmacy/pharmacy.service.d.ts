import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { Cache } from 'cache-manager';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { CreatePrescriptionInput, VerifyPrescriptionInput, PrescriptionOutput } from './dto/pharmacy.types';
export type InteractionSeverity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED';
export interface DrugInteractionResult {
    severity: InteractionSeverity;
    description: string;
    canOverride: boolean;
}
export declare class PharmacyService {
    private readonly cache;
    private readonly dataSource;
    private readonly config;
    private readonly logger;
    constructor(cache: Cache, dataSource: DataSource, config: ConfigService);
    validateGmdcLicence(licenceNo: string): Promise<{
        valid: boolean;
        cached: boolean;
    }>;
    validateRxExpiry(prescribedDate: Date): void;
    checkDrugInteractions(productIds: string[]): Promise<DrugInteractionResult[]>;
    enforceInteractionSeverity(interactions: DrugInteractionResult[]): void;
    private callGmdcApi;
    private resolveRxNormIngredients;
    private lookupRxNormApproximate;
    private analyzeInteractionsWithOpenAI;
    private normalizeInteractionResult;
    private parseGmdcValidity;
    createPrescription(input: CreatePrescriptionInput, actor: JwtUser): Promise<PrescriptionOutput>;
    verifyPrescription(input: VerifyPrescriptionInput, actor: JwtUser): Promise<PrescriptionOutput>;
    getPrescription(id: string): Promise<PrescriptionOutput>;
    getPendingPrescriptions(branchId: string): Promise<PrescriptionOutput[]>;
    getPrescriptionsForProduct(branchId: string, productId: string): Promise<PrescriptionOutput[]>;
    assertPrescriptionCoversProduct(prescriptionId: string, productId: string, quantity: number, branchId: string): Promise<void>;
}
