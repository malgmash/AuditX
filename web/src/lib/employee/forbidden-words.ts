/** Words DESIGN.md bans from anything an employee reads. Tests check every template against this. */
export const FORBIDDEN_WORDS = /\b(fraud|fraudulent|theft|stealing|stole|dishonest|guilty)\b/i;

export function containsForbiddenWord(text: string): boolean {
  return FORBIDDEN_WORDS.test(text);
}
