import { auth } from "../lib/auth.js";
import { env } from "../config/env.js";
import { User } from "../models/user.model.js";
import { conflict, forbidden } from "../utils/app-error.js";

interface BootstrapAdminInput {
  name: string;
  email: string;
  password: string;
}

export async function bootstrapAdmin(input: BootstrapAdminInput) {
  if (env.ADMIN_EMAIL && input.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
    throw forbidden("This email is not authorized for administrator setup");
  }

  const adminExists = await User.exists({ role: "admin" });
  if (adminExists) {
    throw conflict("An administrator account already exists", "ADMIN_EXISTS");
  }

  const emailTaken = await User.exists({ email: input.email.toLowerCase() });
  if (emailTaken) {
    throw conflict("An account with this email already exists", "EMAIL_TAKEN");
  }

  const result = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  await User.updateOne(
    { _id: result.user.id },
    { $set: { role: "admin", isBlocked: false, emailVerified: true } },
  );

  return {
    id: result.user.id,
    name: input.name,
    email: input.email.toLowerCase(),
    role: "admin" as const,
  };
}
