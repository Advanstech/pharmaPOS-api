export interface EmailTemplate {
    subject: string;
    html: string;
    text?: string;
}
export declare class EmailTemplates {
    private static readonly brandColors;
    private static readonly baseUrl;
    static staffInvitation(staffName: string, email: string, temporaryPassword: string, invitedBy: string, branchName: string): EmailTemplate;
    static salesReceipt(customerName: string, customerEmail: string, saleDetails: {
        saleId: string;
        items: Array<{
            name: string;
            quantity: number;
            unitPrice: number;
            total: number;
        }>;
        subtotal: number;
        vat: number;
        total: number;
        paymentMethod: string;
        date: Date;
        branchName: string;
    }): EmailTemplate;
    static customerWelcome(customerName: string, customerCode: string, branchName: string): EmailTemplate;
    static passwordReset(staffName: string, resetToken: string, requestedBy?: string | null): EmailTemplate;
}
