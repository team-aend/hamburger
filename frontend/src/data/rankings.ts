import { burgers } from './burgers';

export type RankingSort = 'championships' | 'winRate';

// UI preview fixtures only; these values are not collected tournament results.
const statistics: Record<string, [number, number, number]> = {
  'classic-cheese': [128, 620, 420], 'double-smash': [112, 590, 410],
  'shrimp-crunch': [96, 540, 330], 'avocado-green': [42, 390, 180],
  'spicy-chicken': [96, 560, 350], 'mushroom-melt': [64, 430, 250],
  'bacon-bbq': [85, 510, 320], 'chili-cheese': [58, 440, 240],
  'truffle-burger': [73, 460, 290], 'hawaiian': [35, 360, 150],
  'blue-cheese': [28, 340, 130], 'egg-morning': [48, 410, 210],
  'bulgogi': [80, 500, 310], 'fish-tartar': [24, 320, 120],
  'onion-ring': [39, 380, 170], 'veggie-bean': [18, 300, 100],
};

export const rankingEntries = burgers.map((burger) => {
  const [championships, matches, wins] = statistics[burger.id];
  return { ...burger, championships, matches, wins, winRate: matches === 0 ? 0 : wins / matches * 100 };
});

export function getRankings(sort: RankingSort) {
  const sorted = [...rankingEntries].sort((a, b) => b[sort] - a[sort] || a.id.localeCompare(b.id));
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || entry[sort] !== sorted[index - 1][sort]) rank = index + 1;
    return { ...entry, rank };
  });
}
