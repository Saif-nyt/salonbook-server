import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { connectToMongoDB, ensureCollections, disconnectFromMongoDB } from "../config/database.js";
import { closeAuthDatabase } from "../lib/auth.js";
import { bootstrapAdmin } from "../services/admin.service.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";

function isInteractive(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

async function promptVisible(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function promptHidden(question: string): Promise<string> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("Password prompt requires an interactive terminal.");
  }

  output.write(question);

  return await new Promise<string>((resolve, reject) => {
    const stdin = input as NodeJS.ReadStream & { isRaw?: boolean };
    const wasRaw = Boolean(stdin.isRaw);
    let value = "";

    const cleanup = () => {
      stdin.removeListener("data", onData);
      if (stdin.isTTY) {
        try {
          stdin.setRawMode(wasRaw);
        } catch {
          // ignore
        }
      }
      stdin.pause();
    };

    const onData = (chunk: Buffer | string) => {
      const str = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      for (const char of str) {
        if (char === "\u0003") {
          cleanup();
          output.write("\n");
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) value = value.slice(0, -1);
          continue;
        }
        // ignore other control chars
        if (char >= " " && char !== "\u007f") {
          value += char;
        }
      }
    };

    try {
      stdin.resume();
      stdin.setRawMode(true);
      stdin.on("data", onData);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function main(): Promise<void> {
  await connectToMongoDB();
  await ensureCollections();

  try {
    const existingAdmin = await User.exists({ role: "admin" });
    if (existingAdmin) {
      console.log("Admin account already exists. No changes made.");
      return;
    }

    const interactive = isInteractive();

    let name =
      readEnv("SEED_ADMIN_NAME") ??
      readEnv("ADMIN_NAME") ??
      "";
    let email =
      readEnv("SEED_ADMIN_EMAIL") ??
      readEnv("ADMIN_EMAIL") ??
      "";
    let password =
      readEnv("SEED_ADMIN_PASSWORD") ??
      readEnv("ADMIN_PASSWORD") ??
      "";

    if (!name) {
      if (interactive) {
        name = await promptVisible("Admin name [SalonBook Admin]: ");
      }
      if (!name) name = "SalonBook Admin";
    }

    if (!email) {
      if (!interactive) {
        throw new Error(
          "Missing admin email. Set SEED_ADMIN_EMAIL or ADMIN_EMAIL, or run this command in an interactive terminal.",
        );
      }
      email = await promptVisible("Admin email: ");
    }

    if (!password) {
      if (!interactive) {
        throw new Error(
          "Missing admin password. Set SEED_ADMIN_PASSWORD or ADMIN_PASSWORD, or run this command in an interactive terminal.",
        );
      }
      password = await promptHidden("Admin password: ");
      const confirm = await promptHidden("Confirm password: ");
      if (password !== confirm) {
        throw new Error("Passwords do not match.");
      }
    }

    if (!email) throw new Error("Admin email is required.");
    if (!password) throw new Error("Admin password is required.");

    const created = await bootstrapAdmin({ name, email, password });
    console.log("Admin account created successfully.");
    console.log(`  id:    ${created.id}`);
    console.log(`  email: ${created.email}`);
    console.log(`  name:  ${created.name}`);
  } catch (error) {
    if (error instanceof AppError && error.code === "ADMIN_EXISTS") {
      console.log("Admin account already exists. No changes made.");
      return;
    }
    if (error instanceof AppError) {
      console.error(`Failed to create admin: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to create admin: ${message}`);
    process.exitCode = 1;
  } finally {
    try {
      await closeAuthDatabase();
    } catch {
      // ignore
    }
    await disconnectFromMongoDB();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to seed admin: ${message}`);
  process.exit(1);
});
