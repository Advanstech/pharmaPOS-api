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
exports.GmdcValidationResult = exports.PrescriptionOutput = exports.PrescriptionItemOutput = exports.VerifyPrescriptionInput = exports.CreatePrescriptionInput = exports.PrescriptionItemInput = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
let PrescriptionItemInput = class PrescriptionItemInput {
};
exports.PrescriptionItemInput = PrescriptionItemInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the POM product being prescribed' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PrescriptionItemInput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Quantity prescribed. Must be >= 1.' }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PrescriptionItemInput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Dosage instructions from the prescriber. Example: "Take 1 tablet twice daily after meals for 7 days".',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PrescriptionItemInput.prototype, "dosageInstructions", void 0);
exports.PrescriptionItemInput = PrescriptionItemInput = __decorate([
    (0, graphql_1.InputType)({ description: 'A single medicine line on a prescription' })
], PrescriptionItemInput);
let CreatePrescriptionInput = class CreatePrescriptionInput {
};
exports.CreatePrescriptionInput = CreatePrescriptionInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the customer this prescription is for' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreatePrescriptionInput.prototype, "customerId", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Ghana Medical and Dental Council (GMDC) licence number of the prescribing doctor. ' +
            'Validated live on creation. Throws GMDC_INVALID_LICENCE if expired or not found.',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePrescriptionInput.prototype, "prescriberLicenceNo", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Full name of the prescribing doctor' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePrescriptionInput.prototype, "prescriberName", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Date the prescription was written. ISO 8601 format. Example: "2026-03-22". ' +
            'Ghana FDA: Rx is valid for exactly 30 days from this date.',
    }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePrescriptionInput.prototype, "prescribedDate", void 0);
__decorate([
    (0, graphql_1.Field)(() => [PrescriptionItemInput], {
        description: 'One or more POM medicines on this prescription. Must not be empty.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PrescriptionItemInput),
    __metadata("design:type", Array)
], CreatePrescriptionInput.prototype, "items", void 0);
exports.CreatePrescriptionInput = CreatePrescriptionInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Create a new prescription for a customer. ' +
            'Ghana FDA: prescriber GMDC licence is validated live on creation. ' +
            'Rx expiry is set to exactly 30 days from prescribedDate — never extendable. ' +
            'Chemical shop branches are blocked by BranchTypeGuard. ' +
            'Requires role: pharmacist or head_pharmacist.',
    })
], CreatePrescriptionInput);
let VerifyPrescriptionInput = class VerifyPrescriptionInput {
};
exports.VerifyPrescriptionInput = VerifyPrescriptionInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the prescription to verify' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], VerifyPrescriptionInput.prototype, "prescriptionId", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Optional pharmacist notes recorded against this verification',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], VerifyPrescriptionInput.prototype, "notes", void 0);
exports.VerifyPrescriptionInput = VerifyPrescriptionInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Verify (approve) a pending prescription. ' +
            'Ghana FDA: Rx expiry is re-checked, GMDC licence is re-validated. ' +
            'Controlled drugs require approval_count >= 2 (two pharmacist sign-offs). ' +
            'Requires role: pharmacist or head_pharmacist.',
    })
], VerifyPrescriptionInput);
let PrescriptionItemOutput = class PrescriptionItemOutput {
};
exports.PrescriptionItemOutput = PrescriptionItemOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of this prescription item' }),
    __metadata("design:type", String)
], PrescriptionItemOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the prescribed product' }),
    __metadata("design:type", String)
], PrescriptionItemOutput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Product name at time of prescription' }),
    __metadata("design:type", String)
], PrescriptionItemOutput.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Quantity prescribed' }),
    __metadata("design:type", Number)
], PrescriptionItemOutput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Dosage instructions from the prescriber' }),
    __metadata("design:type", String)
], PrescriptionItemOutput.prototype, "dosageInstructions", void 0);
exports.PrescriptionItemOutput = PrescriptionItemOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single medicine line on a prescription' })
], PrescriptionItemOutput);
let PrescriptionOutput = class PrescriptionOutput {
};
exports.PrescriptionOutput = PrescriptionOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the prescription' }),
    __metadata("design:type", String)
], PrescriptionOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the branch where the prescription was created' }),
    __metadata("design:type", String)
], PrescriptionOutput.prototype, "branchId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the customer (no PHI — use customer lookup separately)' }),
    __metadata("design:type", String)
], PrescriptionOutput.prototype, "customerId", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'GMDC licence number of the prescribing doctor — validated on creation and verification',
    }),
    __metadata("design:type", String)
], PrescriptionOutput.prototype, "prescriberLicenceNo", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Full name of the prescribing doctor' }),
    __metadata("design:type", String)
], PrescriptionOutput.prototype, "prescriberName", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Date the prescription was written (ISO 8601, Africa/Accra timezone)' }),
    __metadata("design:type", Date)
], PrescriptionOutput.prototype, "prescribedDate", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Ghana FDA: Rx expiry date — exactly 30 days after prescribedDate. ' +
            'Dispensing is blocked after this date with error FDA_RX_EXPIRED.',
    }),
    __metadata("design:type", Date)
], PrescriptionOutput.prototype, "expiryDate", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Current status. Values: PENDING | VERIFIED | DISPENSED | EXPIRED | CANCELLED',
    }),
    __metadata("design:type", String)
], PrescriptionOutput.prototype, "status", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Number of pharmacist sign-offs. Ghana FDA: controlled drugs require approvalCount >= 2.',
    }),
    __metadata("design:type", Number)
], PrescriptionOutput.prototype, "approvalCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => [PrescriptionItemOutput], { description: 'Medicines on this prescription' }),
    __metadata("design:type", Array)
], PrescriptionOutput.prototype, "items", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 timestamp when the prescription was created' }),
    __metadata("design:type", Date)
], PrescriptionOutput.prototype, "createdAt", void 0);
exports.PrescriptionOutput = PrescriptionOutput = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'A prescription record. Lifecycle: PENDING -> VERIFIED -> DISPENSED. ' +
            'Ghana FDA: GMDC licence validated on creation and verification. ' +
            'Rx valid for exactly 30 days. Controlled drugs require approvalCount >= 2. ' +
            'Dispensed Rx PDF uploaded to S3 (5-year retention).',
    })
], PrescriptionOutput);
let GmdcValidationResult = class GmdcValidationResult {
};
exports.GmdcValidationResult = GmdcValidationResult;
__decorate([
    (0, graphql_1.Field)({ description: 'The GMDC licence number that was checked' }),
    __metadata("design:type", String)
], GmdcValidationResult.prototype, "licenceNo", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'true if the licence is valid and active. ' +
            'false throws GMDC_INVALID_LICENCE. ' +
            'If the GMDC API is unreachable, returns true with a warning log — never blocks due to outage.',
    }),
    __metadata("design:type", Boolean)
], GmdcValidationResult.prototype, "valid", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'true if the result was served from Redis cache (24h TTL). false if a live GMDC API call was made.',
    }),
    __metadata("design:type", Boolean)
], GmdcValidationResult.prototype, "cached", void 0);
exports.GmdcValidationResult = GmdcValidationResult = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Result of a GMDC prescriber licence validation check' })
], GmdcValidationResult);
//# sourceMappingURL=pharmacy.types.js.map