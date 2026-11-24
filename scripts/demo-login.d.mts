export function productionIndicators(env: Record<string, string | undefined>): string[];
export function parseEnvFile(text: string, wanted?: string[]): Record<string, string>;
export function readDemoIdentity(
  env: Record<string, string | undefined>,
  rootDir?: string,
): { email?: string; password?: string };
export function validateIdentity(identity: { email?: string; password?: string }): string[];
export function applyDemoSecrets(
  existing: string,
  password: string,
  newSecret?: () => string,
): string;
export function run(
  argv: string[],
  env?: Record<string, string | undefined>,
): { code: number; message: string };
