import type { ErrorCode, ErrorResponse, Locale } from "@repo/shared";
import ar from "@/messages/ar/TrainingErrors.json";
import en from "@/messages/en/TrainingErrors.json";

const MESSAGES = { ar, en };

export type TrainingMessageKey = Exclude<keyof typeof en, "form">;

/** An error a training route answers with, in the user's language. */
export type TrainingError = { status: number; body: ErrorResponse };

export function trainingError(
  code: ErrorCode,
  status: number,
  key: TrainingMessageKey,
  locale: Locale,
): TrainingError {
  return { status, body: { error: { code, message: MESSAGES[locale][key] } } };
}

/** The public form's errors (`POST /api/training/custom-requests`). */
export function formError(
  code: keyof typeof en.form,
  status: number,
  locale: Locale,
): TrainingError {
  return { status, body: { error: { code, message: MESSAGES[locale].form[code] } } };
}
