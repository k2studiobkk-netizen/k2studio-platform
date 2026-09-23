"use client";

export const PASSWORD_ITERATIONS = 100_000;

const fromBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const toBase64 = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value)));

export async function derivePasswordHash(password: string, salt: string, iterations = PASSWORD_ITERATIONS) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return toBase64(await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: fromBase64(salt),
    iterations,
    hash: "SHA-256",
  }, passwordKey, 256));
}

export async function createPasswordMaterial(password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const passwordSalt = btoa(String.fromCharCode(...saltBytes));
  return {
    passwordHash: await derivePasswordHash(password, passwordSalt),
    passwordSalt,
    passwordLength: password.length,
  };
}

export async function createPasswordProof(password: string, salt: string, iterations: number, message: string) {
  const passwordHash = await derivePasswordHash(password, salt, iterations);
  const proofKey = await crypto.subtle.importKey(
    "raw",
    fromBase64(passwordHash),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64(await crypto.subtle.sign("HMAC", proofKey, new TextEncoder().encode(message)));
}
