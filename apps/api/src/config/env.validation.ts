export interface EnvConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  TRUST_PAYMENTS_SITE_REFERENCE: string;
  TRUST_PAYMENTS_JWT_USERNAME: string;
  TRUST_PAYMENTS_JWT_SECRET: string;
  TRUST_PAYMENTS_WEBHOOK_PASSWORD: string;
}

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'TRUST_PAYMENTS_SITE_REFERENCE',
  'TRUST_PAYMENTS_JWT_USERNAME',
  'TRUST_PAYMENTS_JWT_SECRET',
  'TRUST_PAYMENTS_WEBHOOK_PASSWORD',
] as const;

const NODE_ENVS: ReadonlyArray<EnvConfig['NODE_ENV']> = ['development', 'test', 'production'];

export const validateEnv = (config: Record<string, unknown>): EnvConfig => {
  const missing = REQUIRED_KEYS.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.length === 0;
  });
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const nodeEnv = NODE_ENVS.find((env) => env === config['NODE_ENV']) ?? 'development';
  const port = Number(config['PORT'] ?? 3001);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, received: ${String(config['PORT'])}`);
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: config['DATABASE_URL'] as string,
    REDIS_URL: config['REDIS_URL'] as string,
    JWT_SECRET: config['JWT_SECRET'] as string,
    TRUST_PAYMENTS_SITE_REFERENCE: config['TRUST_PAYMENTS_SITE_REFERENCE'] as string,
    TRUST_PAYMENTS_JWT_USERNAME: config['TRUST_PAYMENTS_JWT_USERNAME'] as string,
    TRUST_PAYMENTS_JWT_SECRET: config['TRUST_PAYMENTS_JWT_SECRET'] as string,
    TRUST_PAYMENTS_WEBHOOK_PASSWORD: config['TRUST_PAYMENTS_WEBHOOK_PASSWORD'] as string,
  };
};
