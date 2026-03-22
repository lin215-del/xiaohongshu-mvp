export interface RetryOptions {
  retries: number;
  delayMs: number;
}

export const retry = async <T>(task: () => Promise<T>, options: RetryOptions): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === options.retries) {
        throw lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  throw lastError;
};
