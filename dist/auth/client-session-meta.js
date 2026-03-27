"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractClientSessionMeta = extractClientSessionMeta;
function extractClientSessionMeta(req) {
    var _a, _b, _c, _d, _e, _f;
    if (!req) {
        return { ip: null, userAgent: null };
    }
    const forwarded = req.headers['x-forwarded-for'];
    let ip = null;
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        ip = (_b = (_a = forwarded.split(',')[0]) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : null;
    }
    else if (Array.isArray(forwarded) && forwarded[0]) {
        ip = (_d = (_c = forwarded[0].split(',')[0]) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : null;
    }
    else {
        const raw = (_f = (_e = req.socket) === null || _e === void 0 ? void 0 : _e.remoteAddress) !== null && _f !== void 0 ? _f : req.ip;
        ip = raw ? String(raw) : null;
    }
    if (ip && ip.length > 45) {
        ip = ip.slice(0, 45);
    }
    const ua = req.headers['user-agent'];
    const userAgent = typeof ua === 'string' ? ua.slice(0, 4000) : null;
    return { ip, userAgent };
}
//# sourceMappingURL=client-session-meta.js.map