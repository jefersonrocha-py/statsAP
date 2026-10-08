import { z } from "zod";

export const PASSWORD_POLICY_ITEMS = [
  "Mínimo de 12 caracteres.",
  "Pelo menos uma letra minúscula.",
  "Pelo menos uma letra maiúscula.",
  "Pelo menos um número.",
  "Pelo menos um símbolo.",
] as const;

export const PASSWORD_POLICY_HINT = PASSWORD_POLICY_ITEMS.join(" ");

export const strongPasswordSchema = z
  .string()
  .trim()
  .min(12, "A senha deve ter no mínimo 12 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.")
  .regex(/[a-z]/, "A senha deve conter ao menos uma letra minúscula.")
  .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula.")
  .regex(/\d/, "A senha deve conter ao menos um número.")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um símbolo.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().toLowerCase().trim(),
  password: strongPasswordSchema,
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
