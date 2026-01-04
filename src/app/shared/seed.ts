// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from '../../config';

const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // 1. Create Admin User
    const adminEmail = config.ADMIN_EMAIL || 'super@gmail.com';
    const adminPassword = config.ADMIN_PASSWORD || 'SabbirMridha12';

    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (existingAdmin) {
      console.log(`👤 Admin user already exists: ${adminEmail}`);
    } else {
      const hashed = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
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

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding if executed directly
if (require.main === module) {
  seedDatabase().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { seedDatabase };
