export interface FakeTweetMetrics {
  likes: number;
  comments: number;
  reposts: number;
  views: number;
}

type RandomSource = () => number;

function integerBetween(min: number, max: number, random: RandomSource): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function generateFakeTweetMetrics(random: RandomSource = Math.random): FakeTweetMetrics {
  const views = integerBetween(800, 180000, random);
  const likes = Math.max(1, Math.round(views * (0.018 + random() * 0.06)));
  const reposts = Math.max(1, Math.round(likes * (0.08 + random() * 0.18)));
  const comments = Math.max(1, Math.round(likes * (0.015 + random() * 0.06)));

  return { likes, comments, reposts, views };
}

export function formatMetric(value: number): string {
  const safeValue = Math.max(0, Math.floor(Number(value) || 0));

  if (safeValue >= 1_000_000) {
    return `${(safeValue / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mi`;
  }

  if (safeValue >= 1_000) {
    return `${(safeValue / 1_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mil`;
  }

  return safeValue.toLocaleString("pt-BR");
}
