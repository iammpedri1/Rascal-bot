import type { Logger } from "../types/logger";

const logger = require("./logger") as Logger;

export const SAMPLE_INTERVAL_MS = 5 * 60 * 1000;
export const RSS_WARN_BYTES = 512 * 1024 * 1024;

export interface RuntimeMetrics {
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  externalBytes: number;
}

export function formatBytes(bytes: number): string {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / 1024 ** exponent;
  const decimals = exponent === 0 || scaled >= 100 ? 0 : 1;
  return `${scaled.toFixed(decimals)} ${units[exponent]}`;
}

export function collectRuntimeMetrics(): RuntimeMetrics {
  const memory = process.memoryUsage();
  return {
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
  };
}

export function describeMetrics(metrics: RuntimeMetrics): string {
  return `RAM ${formatBytes(metrics.rssBytes)} · heap ${formatBytes(metrics.heapUsedBytes)}/${formatBytes(metrics.heapTotalBytes)} · externo ${formatBytes(metrics.externalBytes)}`;
}

let started = false;

/**
 * Registra métricas de memória periodicamente para detectar vazamentos em
 * execução contínua. O timer é unref'd para não segurar o processo.
 */
export function startRuntimeMetrics(): void {
  if (started) return;
  started = true;

  const timer = setInterval(() => {
    const metrics = collectRuntimeMetrics();
    const report = {
      rss: formatBytes(metrics.rssBytes),
      heap: formatBytes(metrics.heapUsedBytes),
    };

    if (metrics.rssBytes >= RSS_WARN_BYTES) logger.warn("Uso de RAM acima do esperado", report);
    else logger.debug("Métricas de runtime", report);
  }, SAMPLE_INTERVAL_MS);
  timer.unref?.();
}
