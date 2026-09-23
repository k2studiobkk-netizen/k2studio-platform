export type SubmittedPasswordMaterial = {
  passwordHash?: unknown;
  passwordSalt?: unknown;
  passwordLength?: unknown;
};

function isBase64Bytes(value: string, expectedBytes: number) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)).byteLength === expectedBytes;
  } catch {
    return false;
  }
}

export function readPasswordMaterial(body: SubmittedPasswordMaterial, minimumLength: number) {
  const passwordHash = String(body.passwordHash || "");
  const passwordSalt = String(body.passwordSalt || "");
  const passwordLength = Number(body.passwordLength);
  if (!Number.isInteger(passwordLength) || passwordLength < minimumLength || passwordLength > 72) return null;
  if (!isBase64Bytes(passwordHash, 32) || !isBase64Bytes(passwordSalt, 16)) return null;
  return { passwordHash, passwordSalt };
}
