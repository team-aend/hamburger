import path from 'node:path';
import dotenv from 'dotenv';

// Both src/db and dist/db resolve to the backend directory, regardless of cwd.
export function loadBackendEnvironment(
  directory = path.resolve(__dirname, '../..'),
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const loaded: Record<string, string> = {};
  dotenv.config({ path: path.join(directory, '.env'), processEnv: loaded });
  for (const [key, value] of Object.entries(loaded)) {
    if (environment[key] === undefined) environment[key] = value;
  }
}
