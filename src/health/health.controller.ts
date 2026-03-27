import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

// ── Response schema classes ───────────────────────────────────────────────

class MemoryStats {
  @ApiProperty({ example: 128, description: 'Heap memory used (MB)' })
  heapUsed!: number;

  @ApiProperty({ example: 256, description: 'Total heap allocated (MB)' })
  heapTotal!: number;

  @ApiProperty({ example: 310, description: 'Resident Set Size (MB)' })
  rss!: number;
}

class LivenessResponse {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: string;

  @ApiProperty({ example: '2026-03-22T10:00:00.000Z', description: 'ISO 8601 UTC timestamp' })
  timestamp!: string;

  @ApiProperty({ example: 3600.5, description: 'Process uptime in seconds' })
  uptime!: number;

  @ApiProperty({ type: MemoryStats })
  memory!: MemoryStats;
}

class ReadinessResponse {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status!: string;

  @ApiProperty({ example: '2026-03-22T10:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 'connected', enum: ['connected', 'disconnected'] })
  database!: string;

  @ApiProperty({
    example: 'Connection refused',
    description: 'Only present when status is "error"',
    required: false,
  })
  error?: string;
}

class HealthIndicatorResult {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  status!: string;
}

class DatabaseHealth {
  @ApiProperty({ type: HealthIndicatorResult })
  database!: HealthIndicatorResult;
}

class MemoryHeapHealth {
  @ApiProperty({ type: HealthIndicatorResult })
  memory_heap!: HealthIndicatorResult;
}

class MemoryRssHealth {
  @ApiProperty({ type: HealthIndicatorResult })
  memory_rss!: HealthIndicatorResult;
}

class HealthCheckInfo {
  @ApiProperty({ type: DatabaseHealth })
  database!: DatabaseHealth;

  @ApiProperty({ type: MemoryHeapHealth })
  memory_heap!: MemoryHeapHealth;

  @ApiProperty({ type: MemoryRssHealth })
  memory_rss!: MemoryRssHealth;
}

class HealthCheckResponse {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error', 'shutting_down'] })
  status!: string;

  @ApiProperty({ type: HealthCheckInfo })
  info!: HealthCheckInfo;

  @ApiProperty({ type: HealthCheckInfo })
  details!: HealthCheckInfo;
}

class HealthCheckErrorResponse {
  @ApiProperty({ example: 'error', enum: ['error', 'shutting_down'] })
  status!: string;

  @ApiProperty({ type: HealthCheckInfo })
  info!: HealthCheckInfo;

  @ApiProperty({ type: HealthCheckInfo })
  error!: HealthCheckInfo;

  @ApiProperty({ type: HealthCheckInfo })
  details!: HealthCheckInfo;
}

// ── Controller ────────────────────────────────────────────────────────────

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    @InjectConnection() private connection: Connection,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Full health check',
    description:
      'Checks database connectivity and memory usage. ' +
      'Used by AWS Elastic Beanstalk health monitoring and uptime services. ' +
      'Returns 503 if any indicator is unhealthy — ELB will route traffic away from the instance.',
  })
  @ApiResponse({
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
  })
  @ApiResponse({
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
  })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
    ]);
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Lightweight readiness check for AWS ELB target group health checks and Kubernetes readiness probes. ' +
      'Verifies the database connection is alive with a `SELECT 1` query. ' +
      'Returns 200 when the instance is ready to serve traffic.',
  })
  @ApiResponse({
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
  })
  @ApiResponse({
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
  })
  async readiness() {
    try {
      await this.connection.query('SELECT 1');
      return { status: 'ok', timestamp: new Date().toISOString(), database: 'connected' };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Minimal liveness check — if this endpoint responds, the Node.js process is alive. ' +
      'Used by Kubernetes liveness probes and AWS ELB. ' +
      'Does NOT check database — use `/health/ready` for dependency checks.',
  })
  @ApiResponse({
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
  })
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
}
