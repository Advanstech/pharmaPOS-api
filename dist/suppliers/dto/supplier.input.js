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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSupplierInput = exports.CreateSupplierInput = void 0;
const graphql_1 = require("@nestjs/graphql");
let CreateSupplierInput = class CreateSupplierInput {
};
exports.CreateSupplierInput = CreateSupplierInput;
__decorate([
    (0, graphql_1.Field)({ description: 'Supplier trading name' }),
    __metadata("design:type", String)
], CreateSupplierInput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Primary contact person name' }),
    __metadata("design:type", String)
], CreateSupplierInput.prototype, "contactName", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Contact phone number (Ghana format preferred)' }),
    __metadata("design:type", String)
], CreateSupplierInput.prototype, "phone", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Contact email address' }),
    __metadata("design:type", String)
], CreateSupplierInput.prototype, "email", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Physical or postal address' }),
    __metadata("design:type", String)
], CreateSupplierInput.prototype, "address", void 0);
exports.CreateSupplierInput = CreateSupplierInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Create a new supplier. Requires role: owner or manager.' })
], CreateSupplierInput);
let UpdateSupplierInput = class UpdateSupplierInput {
};
exports.UpdateSupplierInput = UpdateSupplierInput;
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateSupplierInput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateSupplierInput.prototype, "contactName", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateSupplierInput.prototype, "phone", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateSupplierInput.prototype, "email", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateSupplierInput.prototype, "address", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true, description: 'AI reliability score 0–100' }),
    __metadata("design:type", Number)
], UpdateSupplierInput.prototype, "aiScore", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", Boolean)
], UpdateSupplierInput.prototype, "isActive", void 0);
exports.UpdateSupplierInput = UpdateSupplierInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Update an existing supplier. All fields optional. Requires role: owner or manager.' })
], UpdateSupplierInput);
//# sourceMappingURL=supplier.input.js.map