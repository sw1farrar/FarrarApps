import { createHash, randomInt, randomUUID } from "crypto";
import { CHALLENGE_TTL_MINUTES } from "@/lib/auth/device-constants";

export function createDeviceToken() {
  return randomUUID();
}

export function hashChallengeCode(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function generateChallengeCode() {
  return String(randomInt(100000, 1000000));
}

export function challengeExpiresAt(from = new Date()) {
  return new Date(from.getTime() + CHALLENGE_TTL_MINUTES * 60 * 1000);
}
