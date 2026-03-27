import { PharmacyService } from './pharmacy.service';
import { CreatePrescriptionInput, VerifyPrescriptionInput, PrescriptionOutput, GmdcValidationResult } from './dto/pharmacy.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class PharmacyResolver {
    private readonly pharmacyService;
    constructor(pharmacyService: PharmacyService);
    createPrescription(input: CreatePrescriptionInput, actor: JwtUser): Promise<PrescriptionOutput>;
    verifyPrescription(input: VerifyPrescriptionInput, actor: JwtUser): Promise<PrescriptionOutput>;
    prescription(id: string, _actor: JwtUser): Promise<PrescriptionOutput>;
    pendingPrescriptions(actor: JwtUser): Promise<PrescriptionOutput[]>;
    prescriptionsForProduct(productId: string, actor: JwtUser): Promise<PrescriptionOutput[]>;
    validateGmdcLicence(licenceNo: string): Promise<GmdcValidationResult>;
}
