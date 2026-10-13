import { defineConfig } from 'prisma/config';

// Prisma 7 does not auto-load .env files; Node 24 can do it natively.
try {
  process.loadEnvFile();
} catch {
  // No .env file - rely on the real environment (CI, containers).
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // `prisma generate` does not connect, so a placeholder keeps image builds working.
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
