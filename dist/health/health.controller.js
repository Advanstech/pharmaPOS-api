"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const terminus_1 = require("@nestjs/terminus");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
class MemoryStats {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 128, description: 'Heap memory used (MB)' }),
    __metadata("design:type", Number)
], MemoryStats.prototype, "heapUsed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 256, description: 'Total heap allocated (MB)' }),
    __metadata("design:type", Number)
], MemoryStats.prototype, "heapTotal", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 310, description: 'Resident Set Size (MB)' }),
    __metadata("design:type", Number)
], MemoryStats.prototype, "rss", void 0);
class LivenessResponse {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ok', enum: ['ok'] }),
    __metadata("design:type", String)
], LivenessResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-22T10:00:00.000Z', description: 'ISO 8601 UTC timestamp' }),
    __metadata("design:type", String)
], LivenessResponse.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3600.5, description: 'Process uptime in seconds' }),
    __metadata("design:type", Number)
], LivenessResponse.prototype, "uptime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MemoryStats }),
    __metadata("design:type", MemoryStats)
], LivenessResponse.prototype, "memory", void 0);
class ReadinessResponse {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ok', enum: ['ok', 'error'] }),
    __metadata("design:type", String)
], ReadinessResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-22T10:00:00.000Z' }),
    __metadata("design:type", String)
], ReadinessResponse.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'connected', enum: ['connected', 'disconnected'] }),
    __metadata("design:type", String)
], ReadinessResponse.prototype, "database", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Connection refused',
        description: 'Only present when status is "error"',
        required: false,
    }),
    __metadata("design:type", String)
], ReadinessResponse.prototype, "error", void 0);
class HealthIndicatorResult {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'up', enum: ['up', 'down'] }),
    __metadata("design:type", String)
], HealthIndicatorResult.prototype, "status", void 0);
class DatabaseHealth {
}
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthIndicatorResult }),
    __metadata("design:type", HealthIndicatorResult)
], DatabaseHealth.prototype, "database", void 0);
class MemoryHeapHealth {
}
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthIndicatorResult }),
    __metadata("design:type", HealthIndicatorResult)
], MemoryHeapHealth.prototype, "memory_heap", void 0);
class MemoryRssHealth {
}
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthIndicatorResult }),
    __metadata("design:type", HealthIndicatorResult)
], MemoryRssHealth.prototype, "memory_rss", void 0);
class HealthCheckInfo {
}
__decorate([
    (0, swagger_1.ApiProperty)({ type: DatabaseHealth }),
    __metadata("design:type", DatabaseHealth)
], HealthCheckInfo.prototype, "database", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MemoryHeapHealth }),
    __metadata("design:type", MemoryHeapHealth)
], HealthCheckInfo.prototype, "memory_heap", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MemoryRssHealth }),
    __metadata("design:type", MemoryRssHealth)
], HealthCheckInfo.prototype, "memory_rss", void 0);
class HealthCheckResponse {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ok', enum: ['ok', 'error', 'shutting_down'] }),
    __metadata("design:type", String)
], HealthCheckResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthCheckInfo }),
    __metadata("design:type", HealthCheckInfo)
], HealthCheckResponse.prototype, "info", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthCheckInfo }),
    __metadata("design:type", HealthCheckInfo)
], HealthCheckResponse.prototype, "details", void 0);
class HealthCheckErrorResponse {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'error', enum: ['error', 'shutting_down'] }),
    __metadata("design:type", String)
], HealthCheckErrorResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthCheckInfo }),
    __metadata("design:type", HealthCheckInfo)
], HealthCheckErrorResponse.prototype, "info", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthCheckInfo }),
    __metadata("design:type", HealthCheckInfo)
], HealthCheckErrorResponse.prototype, "error", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthCheckInfo }),
    __metadata("design:type", HealthCheckInfo)
], HealthCheckErrorResponse.prototype, "details", void 0);
let HealthController = class HealthController {
    constructor(health, db, memory, connection) {
        this.health = health;
        this.db = db;
        this.memory = memory;
        this.connection = connection;
    }
    check() {
        return this.health.check([
            () => this.db.pingCheck('database', { timeout: 3000 }),
            () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
            () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
        ]);
    }
    async readiness() {
        try {
            await this.connection.query('SELECT 1');
            return { status: 'ok', timestamp: new Date().toISOString(), database: 'connected' };
        }
        catch (error) {
            return {
                status: 'error',
                timestamp: new Date().toISOString(),
                database: 'disconnected',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    liveness() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            },
        };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    (0, terminus_1.HealthCheck)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Full health check',
        description: 'Checks database connectivity and memory usage. ' +
            'Used by AWS Elastic Beanstalk health monitoring and uptime services. ' +
            'Returns 503 if any indicator is unhealthy — ELB will route traffic away from the instance.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'All systems healthy',
        type: HealthCheckResponse,
        content: {
            'application/json': {
                example: {
                    status: 'ok',
                    info: {
                        database: { status: 'up' },
                        memory_heap: { status: 'up' },
                        memory_rss: { status: 'up' },
                    },
                    details: {
                        database: { status: 'up' },
                        memory_heap: { status: 'up' },
                        memory_rss: { status: 'up' },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'One or more health indicators are unhealthy',
        type: HealthCheckErrorResponse,
        content: {
            'application/json': {
                example: {
                    status: 'error',
                    info: { memory_heap: { status: 'up' }, memory_rss: { status: 'up' } },
                    error: { database: { status: 'down', message: 'Connection timeout after 3000ms' } },
                    details: {
                        database: { status: 'down', message: 'Connection timeout after 3000ms' },
                        memory_heap: { status: 'up' },
                        memory_rss: { status: 'up' },
                    },
                },
            },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('ready'),
    (0, swagger_1.ApiOperation)({
        summary: 'Readiness probe',
        description: 'Lightweight readiness check for AWS ELB target group health checks and Kubernetes readiness probes. ' +
            'Verifies the database connection is alive with a `SELECT 1` query. ' +
            'Returns 200 when the instance is ready to serve traffic.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Instance is ready to accept traffic',
        type: ReadinessResponse,
        content: {
            'application/json': {
                example: {
                    status: 'ok',
                    timestamp: '2026-03-22T10:00:00.000Z',
                    database: 'connected',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'Instance is not ready — database unreachable',
        type: ReadinessResponse,
        content: {
            'application/json': {
                example: {
                    status: 'error',
                    timestamp: '2026-03-22T10:00:00.000Z',
                    database: 'disconnected',
                    error: 'connect ECONNREFUSED 127.0.0.1:5432',
                },
            },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "readiness", null);
__decorate([
    (0, common_1.Get)('live'),
    (0, swagger_1.ApiOperation)({
        summary: 'Liveness probe',
        description: 'Minimal liveness check — if this endpoint responds, the Node.js process is alive. ' +
            'Used by Kubernetes liveness probes and AWS ELB. ' +
            'Does NOT check database — use `/health/ready` for dependency checks.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Process is alive',
        type: LivenessResponse,
        content: {
            'application/json': {
                example: {
                    status: 'ok',
                    timestamp: '2026-03-22T10:00:00.000Z',
                    uptime: 3600.5,
                    memory: { heapUsed: 128, heapTotal: 256, rss: 310 },
                },
            },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "liveness", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('health'),
    (0, common_1.Controller)('health'),
    __param(3, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [terminus_1.HealthCheckService,
        terminus_1.TypeOrmHealthIndicator,
        terminus_1.MemoryHealthIndicator,
        typeorm_2.Connection])
], HealthController);
//# sourceMappingURL=health.controller.js.map