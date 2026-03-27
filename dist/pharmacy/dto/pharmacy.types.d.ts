export declare class PrescriptionItemInput {
    productId: string;
    quantity: number;
    dosageInstructions?: string;
}
export declare class CreatePrescriptionInput {
    customerId: string;
    prescriberLicenceNo: string;
    prescriberName: string;
    prescribedDate: string;
    items: PrescriptionItemInput[];
}
export declare class VerifyPrescriptionInput {
    prescriptionId: string;
    notes?: string;
}
export declare class PrescriptionItemOutput {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    dosageInstructions?: string;
}
export declare class PrescriptionOutput {
    id: string;
    branchId: string;
    customerId: string;
    prescriberLicenceNo: string;
    prescriberName: string;
    prescribedDate: Date;
    expiryDate: Date;
    status: string;
    approvalCount: number;
    items: PrescriptionItemOutput[];
    createdAt: Date;
}
export declare class GmdcValidationResult {
    licenceNo: string;
    valid: boolean;
    cached: boolean;
}
