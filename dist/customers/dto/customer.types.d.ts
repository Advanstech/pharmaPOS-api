export declare enum CustomerSex {
    MALE = "male",
    FEMALE = "female",
    OTHER = "other",
    PREFER_NOT_TO_SAY = "prefer_not_to_say"
}
export declare class CreateCustomerInput {
    name?: string;
    phone?: string;
    sex?: CustomerSex;
    ageYears?: number;
    ghanaCardNumber?: string;
}
export declare class UpdateCustomerInput {
    customerId: string;
    name?: string;
    phone?: string;
    sex?: CustomerSex;
    ageYears?: number;
    ghanaCardNumber?: string;
}
export declare class CustomerOutput {
    id: string;
    branchId: string;
    customerCode: string;
    name?: string;
    hasPhone: boolean;
    sex?: CustomerSex;
    ageYears?: number;
    hasGhanaCard: boolean;
    createdAt: Date;
}
