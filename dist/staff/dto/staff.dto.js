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
exports.InviteStaffResult = exports.StaffSessionOutput = exports.StaffMemberOutput = exports.ResetStaffPasswordInput = exports.UpdateStaffProfileInput = exports.InviteStaffInput = exports.Gender = exports.EmploymentType = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
var EmploymentType;
(function (EmploymentType) {
    EmploymentType["FULL_TIME"] = "full_time";
    EmploymentType["PART_TIME"] = "part_time";
    EmploymentType["CONTRACT"] = "contract";
})(EmploymentType || (exports.EmploymentType = EmploymentType = {}));
var Gender;
(function (Gender) {
    Gender["MALE"] = "male";
    Gender["FEMALE"] = "female";
    Gender["OTHER"] = "other";
    Gender["PREFER_NOT_TO_SAY"] = "prefer_not_to_say";
})(Gender || (exports.Gender = Gender = {}));
let InviteStaffInput = class InviteStaffInput {
};
exports.InviteStaffInput = InviteStaffInput;
__decorate([
    (0, graphql_1.Field)({ description: 'Full legal name of the staff member' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InviteStaffInput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Work email address. Used as login identifier if provided.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], InviteStaffInput.prototype, "email", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Phone number (Ghana format preferred, e.g. `0244123456`). ' +
            'Stored AES-256 encrypted — Ghana Data Protection Act 2012.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InviteStaffInput.prototype, "phone", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Role assigned to this staff member. ' +
            'Values: `owner` | `head_pharmacist` | `pharmacist` | `cashier` | `manager`',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InviteStaffInput.prototype, "role", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Job title. Example: `"Senior Pharmacist"`' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InviteStaffInput.prototype, "position", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Department. Example: `"Dispensary"`, `"Front Desk"`' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InviteStaffInput.prototype, "department", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Employment type. Values: `full_time` | `part_time` | `contract`',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(EmploymentType),
    __metadata("design:type", String)
], InviteStaffInput.prototype, "employment_type", void 0);
exports.InviteStaffInput = InviteStaffInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Invite a new staff member to the branch. ' +
            'A temporary password is generated and returned — share it securely with the staff member. ' +
            'PII fields (phone, address, Ghana Card) are AES-256 encrypted at rest per Ghana Data Protection Act 2012. ' +
            'Requires role: `owner` or `manager`.',
    })
], InviteStaffInput);
let UpdateStaffProfileInput = class UpdateStaffProfileInput {
};
exports.UpdateStaffProfileInput = UpdateStaffProfileInput;
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of the user to update' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "userId", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Job title' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "position", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Department' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "department", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Employment type' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(EmploymentType),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "employment_type", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Gender (optional, self-reported)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(Gender),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "gender", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Employment start date. ISO 8601. Example: `"2025-01-15"`' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "start_date", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Employment end date (for contract/terminated staff)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "end_date", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Ghana Pharmacy Council or GMDC professional licence number. ' +
            'Required for pharmacist roles — used for regulatory compliance.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "professional_licence_no", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Expiry date of the professional licence. ISO 8601.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "licence_expiry_date", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Emergency contact full name' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "emergency_contact_name", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Emergency contact phone number. Stored encrypted.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "emergency_contact_phone", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Internal HR notes. Not visible to the staff member.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "notes", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Phone number. Stored AES-256 encrypted — Ghana Data Protection Act 2012. ' +
            'Provide in plain text — the service encrypts before storing.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "phone", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Residential address. Stored AES-256 encrypted.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "address", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Date of birth. ISO 8601. Stored AES-256 encrypted.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "date_of_birth", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Ghana Card (National ID) number. Stored AES-256 encrypted. ' +
            'Format: `GHA-XXXXXXXXX-X`.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStaffProfileInput.prototype, "ghana_card_number", void 0);
exports.UpdateStaffProfileInput = UpdateStaffProfileInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Update a staff member\'s profile. All fields are optional — only provided fields are updated. ' +
            'PII fields (phone, address, Ghana Card, date of birth) are AES-256 encrypted before storage. ' +
            'Requires role: `owner` or `manager`. Staff can update their own non-PII fields.',
    })
], UpdateStaffProfileInput);
let ResetStaffPasswordInput = class ResetStaffPasswordInput {
};
exports.ResetStaffPasswordInput = ResetStaffPasswordInput;
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of the user whose password is being reset' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ResetStaffPasswordInput.prototype, "userId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'New password. Minimum 8 characters.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], ResetStaffPasswordInput.prototype, "newPassword", void 0);
exports.ResetStaffPasswordInput = ResetStaffPasswordInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Reset a staff member\'s password. Generates a new bcrypt hash (cost 12). ' +
            'Requires role: `owner` or `manager`. ' +
            'The staff member will be required to change their password on next login.',
    })
], ResetStaffPasswordInput);
let StaffMemberOutput = class StaffMemberOutput {
};
exports.StaffMemberOutput = StaffMemberOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the user account' }),
    __metadata("design:type", String)
], StaffMemberOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Full name' }),
    __metadata("design:type", String)
], StaffMemberOutput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Work email address' }),
    __metadata("design:type", String)
], StaffMemberOutput.prototype, "email", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Assigned role. Values: `owner` | `head_pharmacist` | `pharmacist` | `cashier` | `manager`',
    }),
    __metadata("design:type", String)
], StaffMemberOutput.prototype, "role", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of the branch this staff member belongs to' }),
    __metadata("design:type", String)
], StaffMemberOutput.prototype, "branch_id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: '`true` if the account is active. Deactivated accounts cannot log in.' }),
    __metadata("design:type", Boolean)
], StaffMemberOutput.prototype, "is_active", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Job title' }),
    __metadata("design:type", String)
], StaffMemberOutput.prototype, "position", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Department' }),
    __metadata("design:type", String)
], StaffMemberOutput.prototype, "department", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Employment type' }),
    __metadata("design:type", String)
], StaffMemberOutput.prototype, "employment_type", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Professional licence number (pharmacists). Used for Ghana FDA compliance.',
    }),
    __metadata("design:type", String)
], StaffMemberOutput.prototype, "professional_licence_no", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Professional licence expiry date' }),
    __metadata("design:type", Date)
], StaffMemberOutput.prototype, "licence_expiry_date", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Employment start date' }),
    __metadata("design:type", Date)
], StaffMemberOutput.prototype, "start_date", void 0);
__decorate([
    (0, graphql_1.Field)(() => [String], {
        description: 'S3 keys for uploaded certificates (professional licences, training certs). ' +
            'Use the pre-signed URL endpoint to download.',
    }),
    __metadata("design:type", Array)
], StaffMemberOutput.prototype, "certificate_s3_keys", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 timestamp when the account was created' }),
    __metadata("design:type", Date)
], StaffMemberOutput.prototype, "created_at", void 0);
exports.StaffMemberOutput = StaffMemberOutput = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'A staff member\'s profile. PII fields (phone, address, Ghana Card) are ' +
            'decrypted before returning — only accessible to `owner` and `manager` roles.',
    })
], StaffMemberOutput);
let StaffSessionOutput = class StaffSessionOutput {
};
exports.StaffSessionOutput = StaffSessionOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], StaffSessionOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { name: 'userId' }),
    __metadata("design:type", String)
], StaffSessionOutput.prototype, "user_id", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StaffSessionOutput.prototype, "user_name", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StaffSessionOutput.prototype, "user_role", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { name: 'branchId' }),
    __metadata("design:type", String)
], StaffSessionOutput.prototype, "branch_id", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StaffSessionOutput.prototype, "branch_name", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { name: 'sessionId' }),
    __metadata("design:type", String)
], StaffSessionOutput.prototype, "session_id", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], StaffSessionOutput.prototype, "started_at", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Set when the user logged out or sessions were invalidated.' }),
    __metadata("design:type", Date)
], StaffSessionOutput.prototype, "ended_at", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Updated on each successful refresh-token exchange while the session is open.' }),
    __metadata("design:type", Date)
], StaffSessionOutput.prototype, "last_seen_at", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], StaffSessionOutput.prototype, "ip_address", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], StaffSessionOutput.prototype, "user_agent", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'True when no explicit end time has been recorded (session may still be active or may have expired server-side).',
    }),
    __metadata("design:type", Boolean)
], StaffSessionOutput.prototype, "is_open", void 0);
exports.StaffSessionOutput = StaffSessionOutput = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Recorded staff sign-in session: login time, last token refresh, optional explicit logout. ' +
            'Managers see their branch; owners and SE admins see all branches in the organization (or filter by branch).',
    })
], StaffSessionOutput);
let InviteStaffResult = class InviteStaffResult {
};
exports.InviteStaffResult = InviteStaffResult;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the newly created user account' }),
    __metadata("design:type", String)
], InviteStaffResult.prototype, "userId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Full name of the invited staff member' }),
    __metadata("design:type", String)
], InviteStaffResult.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'System-generated temporary password. ' +
            'Share this securely with the staff member — it is shown only once. ' +
            'The staff member must change it on first login.',
    }),
    __metadata("design:type", String)
], InviteStaffResult.prototype, "temporaryPassword", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Human-readable confirmation message' }),
    __metadata("design:type", String)
], InviteStaffResult.prototype, "message", void 0);
exports.InviteStaffResult = InviteStaffResult = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Result of a successful staff invitation' })
], InviteStaffResult);
//# sourceMappingURL=staff.dto.js.map