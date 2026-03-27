"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
const typeorm_1 = require("typeorm");
const path_1 = require("path");
const dotenv = require("dotenv");
dotenv.config();
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    url: (_a = process.env['DATABASE_DIRECT_URL']) !== null && _a !== void 0 ? _a : process.env['DATABASE_URL'],
    entities: [(0, path_1.join)(__dirname, '../**/*.entity{.ts,.js}')],
    migrations: [(0, path_1.join)(__dirname, '../migrations/*{.ts,.js}')],
    synchronize: false,
    ssl: { rejectUnauthorized: false },
});
//# sourceMappingURL=data-source.js.map