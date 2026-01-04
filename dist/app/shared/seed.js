"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
// prisma/seed.ts
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../../config");
const prisma = new client_1.PrismaClient();
function seedDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🌱 Starting database seeding...\n');
        try {
            // 1. Create Admin User
            const adminEmail = config_1.config.ADMIN_EMAIL || 'super@gmail.com';
            const adminPassword = config_1.config.ADMIN_PASSWORD || 'SabbirMridha12';
            const existingAdmin = yield prisma.user.findUnique({ where: { email: adminEmail } });
            if (existingAdmin) {
                console.log(`👤 Admin user already exists: ${adminEmail}`);
            }
            else {
                const hashed = yield bcryptjs_1.default.hash(adminPassword, 10);
                yield prisma.user.create({
                    data: {
                        email: adminEmail,
                        password: hashed,
                        role: 'ADMIN',
                        isVerified: true,
                        needPasswordChange: false,
                        status: 'ACTIVE',
                    },
                });
                console.log(`👤 Admin user created: ${adminEmail}`);
            }
            console.log('\n🎉 Seeding completed successfully!');
        }
        catch (error) {
            console.error('❌ Seeding failed:', error);
            process.exit(1);
        }
        finally {
            yield prisma.$disconnect();
        }
    });
}
// Run the seeding if executed directly
if (require.main === module) {
    seedDatabase().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
