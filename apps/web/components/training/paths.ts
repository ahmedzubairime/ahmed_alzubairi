/** The training pages' addresses, without the language prefix. */
export const TRAINING_PATH = "/training";
export const CUSTOM_TRAINING_ID = "custom-training";
export const CUSTOM_TRAINING_PATH = `${TRAINING_PATH}#${CUSTOM_TRAINING_ID}`;
export const MY_COURSES_PATH = "/account/courses";

export function coursePath(slug: string): string {
  return `${TRAINING_PATH}/${encodeURIComponent(slug)}`;
}
