import { z } from "zod";
import { strongPasswordSchema } from "@lib/validatorsAuth";

// Validação do que o próprio usuário edita em Minha Conta.

export const PROFILE_NAME_MAX = 80;
export const PROFILE_JOB_TITLE_MAX = 100;
export const PROFILE_PHONE_MAX = 30;

function isValidPhone(value: string) {
  if (!/^[0-9+()\-. ]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15;
}

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((value) => (value ? value : null));

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome (mínimo de 2 caracteres).")
    .max(PROFILE_NAME_MAX, `O nome pode ter no máximo ${PROFILE_NAME_MAX} caracteres.`),
  jobTitle: optionalText(PROFILE_JOB_TITLE_MAX, `O cargo pode ter no máximo ${PROFILE_JOB_TITLE_MAX} caracteres.`),
  phone: optionalText(PROFILE_PHONE_MAX, `O telefone pode ter no máximo ${PROFILE_PHONE_MAX} caracteres.`).refine(
    (value) => value === null || isValidPhone(value),
    "Telefone inválido. Use de 8 a 15 dígitos, com DDD (e DDI, se quiser)."
  ),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(200),
  currentPassword: z.string().min(1, "Informe a senha atual.").max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual.").max(72),
  newPassword: strongPasswordSchema,
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
