export type Classification = 'OTC' | 'POM' | 'CONTROLLED';
export type BranchType = 'pharmaceutical' | 'chemical' | 'both';
export declare class Product {
    id: string;
    name: string;
    genericName?: string;
    barcode?: string;
    unitPrice: number;
    classification: Classification;
    branchType: BranchType;
    vatExempt: boolean;
    requiresRx: boolean;
    imageId?: string;
    categoryId?: string;
    supplierId?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
