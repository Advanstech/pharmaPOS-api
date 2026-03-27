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
exports.CustomerOutput = exports.UpdateCustomerInput = exports.CreateCustomerInput = exports.CustomerSex = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
var CustomerSex;
(function (CustomerSex) {
    CustomerSex["MALE"] = "male";
    CustomerSex["FEMALE"] = "female";
    CustomerSex["OTHER"] = "other";
    CustomerSex["PREFER_NOT_TO_SAY"] = "prefer_not_to_say";
})(CustomerSex || (exports.CustomerSex = CustomerSex = {}));
(0, graphql_1.registerEnumType)(CustomerSex, { name: 'CustomerSex' });
let CreateCustomerInput = class CreateCustomerInput {
};
exports.CreateCustomerInput = CreateCustomerInput;
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Display name when the customer agrees to share it.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateCustomerInput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Mobile number (Ghana). Stored as a salted hash for deduplication — not returned in APIs.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreateCustomerInput.prototype, "phone", void 0);
__decorate([
    (0, graphql_1.Field)(() => CustomerSex, {
        nullable: true,
        description: 'Optional — clinical and reporting use only.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(CustomerSex),
    __metadata("design:type", String)
], CreateCustomerInput.prototype, "sex", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        nullable: true,
        description: 'Approximate age in years (optional alternative to full DOB).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(130),
    __metadata("design:type", Number)
], CreateCustomerInput.prototype, "ageYears", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Ghana Card identifier — encrypted at rest (Ghana DPA 2012).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateCustomerInput.prototype, "ghanaCardNumber", void 0);
exports.CreateCustomerInput = CreateCustomerInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Register a customer at the branch. Name and phone are optional (walk-ins). A unique **customerCode** ' +
            '(e.g. `PP-X7K2M9P4`) is always generated for receipts and linkage. Ghana Card is stored encrypted.',
    })
], CreateCustomerInput);
let UpdateCustomerInput = class UpdateCustomerInput {
};
exports.UpdateCustomerInput = UpdateCustomerInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateCustomerInput.prototype, "customerId", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateCustomerInput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], UpdateCustomerInput.prototype, "phone", void 0);
__decorate([
    (0, graphql_1.Field)(() => CustomerSex, { nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(CustomerSex),
    __metadata("design:type", String)
], UpdateCustomerInput.prototype, "sex", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(130),
    __metadata("design:type", Number)
], UpdateCustomerInput.prototype, "ageYears", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Set to empty string to clear stored Ghana Card.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpdateCustomerInput.prototype, "ghanaCardNumber", void 0);
exports.UpdateCustomerInput = UpdateCustomerInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Update optional profile fields for an existing customer.' })
], UpdateCustomerInput);
let CustomerOutput = class CustomerOutput {
};
exports.CustomerOutput = CustomerOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], CustomerOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], CustomerOutput.prototype, "branchId", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Stable public reference (e.g. PP-XXXXXXXX) — use when the person declines a name.',
    }),
    __metadata("design:type", String)
], CustomerOutput.prototype, "customerCode", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Decrypted name when on file; otherwise null (use customerCode on receipts).',
    }),
    __metadata("design:type", String)
], CustomerOutput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'True when a phone number was captured (number itself is never returned).' }),
    __metadata("design:type", Boolean)
], CustomerOutput.prototype, "hasPhone", void 0);
__decorate([
    (0, graphql_1.Field)(() => CustomerSex, { nullable: true }),
    __metadata("design:type", String)
], CustomerOutput.prototype, "sex", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true }),
    __metadata("design:type", Number)
], CustomerOutput.prototype, "ageYears", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'True when an encrypted Ghana Card value exists.' }),
    __metadata("design:type", Boolean)
], CustomerOutput.prototype, "hasGhanaCard", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], CustomerOutput.prototype, "createdAt", void 0);
exports.CustomerOutput = CustomerOutput = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Branch customer. **customerCode** is safe on receipts. Name and Ghana Card raw values are never logged.',
    })
], CustomerOutput);
//# sourceMappingURL=customer.types.js.map