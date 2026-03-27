export interface JwtUser {
    sub: string;
    role: string;
    branchId: string;
    branchType: 'pharmaceutical' | 'chemical';
    sessionId: string;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
