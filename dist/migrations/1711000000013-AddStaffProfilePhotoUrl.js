"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddStaffProfilePhotoUrl1711000000013 = void 0;
class AddStaffProfilePhotoUrl1711000000013 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE staff_profiles
      ADD COLUMN IF NOT EXISTS photo_url TEXT
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE staff_profiles
      DROP COLUMN IF EXISTS photo_url
    `);
    }
}
exports.AddStaffProfilePhotoUrl1711000000013 = AddStaffProfilePhotoUrl1711000000013;
//# sourceMappingURL=1711000000013-AddStaffProfilePhotoUrl.js.map