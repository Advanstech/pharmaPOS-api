"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const platform_express_1 = require("@nestjs/platform-express");
let app;
let server;
async function bootstrap() {
    if (!app) {
        const express = require('express');
        server = express();
        const adapter = new platform_express_1.ExpressAdapter(server);
        app = await core_1.NestFactory.create(app_module_1.AppModule, adapter, { logger: ['error'] });
        app.enableCors({
            origin: true,
            credentials: true,
        });
        app.setGlobalPrefix('api');
        await app.init();
    }
    return app;
}
async function handler(req, res) {
    await bootstrap();
    server(req, res);
}
//# sourceMappingURL=index.js.map