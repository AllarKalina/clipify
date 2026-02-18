import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "v1";

function decodeKey(secret: string): Buffer {
  const raw = Buffer.from(secret, "base64");
  if (raw.length !== 32) {
    throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY must be base64-encoded 32 bytes");
  }

  return raw;
}

export function createStateHash(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export type TokenCipher = {
  encrypt: (token: string) => string;
  decrypt: (token: string) => string;
};

export function createTokenCipher(secret: string): TokenCipher {
  const key = decodeKey(secret);

  return {
    encrypt(token) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(token, "utf-8"), cipher.final()]);
      const tag = cipher.getAuthTag();

      return [TOKEN_PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
    },
    decrypt(token) {
      const parts = token.split(".");
      if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) {
        return token;
      }

      const iv = Buffer.from(parts[1], "base64url");
      const tag = Buffer.from(parts[2], "base64url");
      const encrypted = Buffer.from(parts[3], "base64url");

      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);

      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf-8");
    }
  };
}
