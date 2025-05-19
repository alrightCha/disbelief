// --- tiny utility ----------------------------------------------------------
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5,
  waitMs = 500
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        console.log(`Retrying .. ${attempt} / ${maxAttempts}`)
        await delay(waitMs);
      }
    }
  }

  throw lastErr; // only reached if all attempts failed
}
