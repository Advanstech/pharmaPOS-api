import type { IncomingHttpHeaders } from 'http';
export interface ClientSessionMeta {
    ip: string | null;
    userAgent: string | null;
}
export interface HttpRequestLike {
    headers: IncomingHttpHeaders;
    ip?: string;
    socket?: {
        remoteAddress?: string;
    };
}
export declare function extractClientSessionMeta(req: HttpRequestLike | undefined): ClientSessionMeta;
