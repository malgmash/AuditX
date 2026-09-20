// Sets the password on an existing user. Development recovery only: there is no reset flow yet,
// so a typo at sign-up otherwise locks the account out for good.
// Run: npm run db:set-password -- someone@example.com
// The password is prompted for, not passed as an argument, so it stays out of the shell history.

import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

// tsx does not read env files the way next dev does, so load the same ones by hand.
for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const db = new PrismaClient();

const MIN_LENGTH = 10;

function prompt(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stdout.write(question);
    let value = "";
    const { stdin } = process;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const done = (err?: Error) => {
      stdin.removeListener("data", onData);
      if (stdin.isTTY) stdin.setRawMode(!!wasRaw);
      stdin.pause();
      process.stdout.write("\n");
      if (err) reject(err);
      else resolve(value);
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return done();
        if (char === "\u0003") return done(new Error("Cancelled"));
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run db:set-password -- someone@example.com");

  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, role: true } });
  if (!user) throw new Error(`No user with email ${email}`);

  const password = await prompt(`New password for ${user.name} (${email}): `);
  if (password.length < MIN_LENGTH) throw new Error(`Password must be at least ${MIN_LENGTH} characters`);
  const again = await prompt("Confirm password: ");
  if (password !== again) throw new Error("Passwords do not match");

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(password) } });
  console.log(`password updated for ${email} (${user.role.toLowerCase()})`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
