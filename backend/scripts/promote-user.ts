/**
 * Changes a user's role (first admin bootstrap, support tooling).
 *
 *   npm run user:promote -- someone@example.com ADMIN
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client.js';

try {
  process.loadEnvFile();
} catch {
  // rely on real environment
}

const [email, role] = process.argv.slice(2);
if (!email || !role || !(role in UserRole)) {
  console.error(`Usage: npm run user:promote -- <email> <${Object.keys(UserRole).join('|')}>`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const user = await prisma.user.update({
    where: { email: email.trim().toLowerCase() },
    data: { role: role as UserRole },
  });
  console.log(`Updated ${user.email} -> ${user.role}`);
} finally {
  await prisma.$disconnect();
}
