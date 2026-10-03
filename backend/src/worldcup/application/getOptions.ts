import { buildWorldcupOptions } from '../domain/options.js';

export function createGetWorldcupOptions(countProducts: () => Promise<number>) {
  return async () => buildWorldcupOptions(await countProducts());
}
