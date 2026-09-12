import { createHmac, timingSafeEqual } from "crypto";

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function signHs256Jwt(payload: Record<string, unknown>, secret: string): string {
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson(payload);
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyHs256Jwt(token: string, secret: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_token");
  }
  const [header, body, signature] = parts;
  let parsedHeader: { alg?: string };
  try {
    parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as {
      alg?: string;
    };
  } catch {
    throw new Error("invalid_token");
  }
  if (parsedHeader.alg !== "HS256") {
    throw new Error("invalid_token");
  }

  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    throw new Error("invalid_token");
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error("invalid_token");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    throw new Error("invalid_token");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new Error("invalid_token");
  }
  return payload;
}
