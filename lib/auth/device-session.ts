export function sessionOkValue(userId: string, deviceToken: string) {
  return `${userId}.${deviceToken}`;
}

export function parseSessionOkValue(value: string | undefined) {
  if (!value) return null;
  const [userId, deviceToken] = value.split(".");
  if (!userId || !deviceToken) return null;
  return { userId, deviceToken };
}
