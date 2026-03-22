export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const format = (level: string, message: string, meta?: Record<string, unknown>): string => {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${new Date().toISOString()}] [${level}] ${message}${suffix}`;
};

export const logger: Logger = {
  info(message, meta) {
    console.log(format('INFO', message, meta));
  },
  warn(message, meta) {
    console.warn(format('WARN', message, meta));
  },
  error(message, meta) {
    console.error(format('ERROR', message, meta));
  }
};
