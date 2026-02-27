import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("[ensureAdmin] ADMIN_EMAIL and ADMIN_PASSWORD env vars are required");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));

  if (existing) {
    await db.update(schema.users)
      .set({
        passwordHash,
        role: "ADMIN",
        accountStatus: "ACTIVE",
        emailVerified: true,
        mustChangePassword: false,
      })
      .where(eq(schema.users.id, existing.id));
    console.log(`[ensureAdmin] Updated admin user: ${email}`);
  } else {
    await db.insert(schema.users).values({
      fullName: "System Admin",
      email,
      passwordHash,
      role: "ADMIN",
      accountStatus: "ACTIVE",
      emailVerified: true,
      mustChangePassword: false,
    });
    console.log(`[ensureAdmin] Created admin user: ${email}`);
  }

  process.exit(0);
}

ensureAdmin().catch((err) => {
  console.error("[ensureAdmin] Error:", err.message);
  process.exit(1);
});
