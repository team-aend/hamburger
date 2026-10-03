import type { RoundSize, WorldcupProduct, WorldcupSessionState, createInitialSession } from '../domain/session.js';

export class WorldcupStorageUnavailable extends Error {
  constructor() { super('Worldcup storage unavailable'); }
}

export interface StartWorldcupInput {
  roundSize: RoundSize;
  requestKey: string;
  ownerHash: string;
}

export interface StartWorldcupResult {
  replayed: boolean;
  response: WorldcupSessionState;
}

export interface CreationRecord {
  ownerHash: string;
  bodyHash: string;
  state: WorldcupSessionState | null;
  expired: boolean;
}

export interface WorldcupTransaction {
  reserveCreation(input: StartWorldcupInput, bodyHash: string, ttl: number): Promise<boolean>;
  findCreation(requestKey: string): Promise<CreationRecord | undefined>;
  lockOwner(ownerHash: string): Promise<void>;
  recentCreationCount(ownerHash: string, windowSeconds: number): Promise<{ count: number; retryAfter: number }>;
  listProducts(): Promise<WorldcupProduct[]>;
  expiration(ttl: number): Promise<string>;
  saveSession(ownerHash: string, session: ReturnType<typeof createInitialSession>): Promise<void>;
  finishCreation(requestKey: string, state: WorldcupSessionState): Promise<void>;
}

export interface WorldcupUnitOfWork {
  transaction<T>(work: (tx: WorldcupTransaction) => Promise<T>): Promise<T>;
}

export interface WorldcupRuntime {
  lifetimeSeconds(): number;
  hashBody(roundSize: RoundSize): string;
  random(max: number): number;
  uuid(): string;
}
