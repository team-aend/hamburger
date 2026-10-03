export function buildWorldcupOptions(eligibleProductCount: number) {
  return {
    eligibleProductCount,
    roundOptions: ([8, 16] as const).map((roundSize) => ({
      roundSize,
      available: eligibleProductCount >= roundSize,
    })),
  };
}
