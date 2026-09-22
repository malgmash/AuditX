import { randomInt } from "node:crypto";

/**
 * Characters an organisation's join code is drawn from: uppercase letters and digits, minus the
 * ones people misread for each other (0/O, 1/I). The code is not a secret key on its own — it only
 * ever grants the EMPLOYEE role (see `toEmployeeCreateInput`) — so it favours being easy to read
 * aloud and retype over cryptographic strength.
 */
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A new organisation's join code, for its employees to sign up with. */
export function generateJoinCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/** Case- and whitespace-insensitive, since people retype these from a chat message or a sticky note. */
export function normalizeJoinCode(value: string): string {
  return value.trim().toUpperCase();
}
