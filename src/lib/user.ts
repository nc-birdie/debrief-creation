import os from "node:os";
import { prisma } from "@/lib/db";

/** Auto-detect the current OS user and upsert into the database. */
export async function getCurrentUser() {
  const username = os.userInfo().username;

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, displayName: username },
  });

  return user;
}
