const MAX_REQUESTS_PER_MINUTE = 10;
const RATE_LIMIT_TTL_SECONDS = 120;

export async function checkRateLimit(
  namespace: KVNamespace,
  ip: string,
  prefix = 'rate'
): Promise<{ allowed: boolean; remaining: number }> {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const rateKey = `${prefix}:${ip}:${minuteBucket}`;

  const raw = await namespace.get(rateKey);
  const count = Number(raw ?? 0);

  if (count >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0 };
  }

  await namespace.put(rateKey, String(count + 1), {
    expirationTtl: RATE_LIMIT_TTL_SECONDS,
  });

  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - count - 1 };
}
