export interface RateLimiterOptions {
    max: number;
    windowMs: number;
    maxTrackedKeys?: number;
}

export interface RateLimitResult {
    allowed: boolean;
    retryAfterMs: number;
}

export interface RateLimiter {
    check(key: string, now?: number): RateLimitResult;
}

/**
 * Janela deslizante por chave com poda periódica, para bloquear flood sem deixar
 * o mapa crescer indefinidamente. Sem estado global, o que facilita os testes.
 */
export function createRateLimiter({
    max,
    windowMs,
    maxTrackedKeys = 10_000,
}: RateLimiterOptions): RateLimiter {
    if (!Number.isFinite(max) || max < 1) throw new Error("max deve ser um número >= 1");
    if (!Number.isFinite(windowMs) || windowMs < 1) throw new Error("windowMs deve ser um número >= 1");
    if (!Number.isFinite(maxTrackedKeys) || maxTrackedKeys < 1) {
        throw new Error("maxTrackedKeys deve ser um número >= 1");
    }

    const hits = new Map<string, number[]>();
    let operationsUntilPrune = 0;

    function prune(now: number): void {
        for (const [key, timestamps] of hits) {
            const active = timestamps.filter((timestamp) => now - timestamp < windowMs);
            if (active.length) hits.set(key, active);
            else hits.delete(key);
        }

        while (hits.size > maxTrackedKeys) {
            const oldest = hits.keys().next().value;
            if (oldest === undefined) break;
            hits.delete(oldest);
        }
    }

    function check(key: string, now = Date.now()): RateLimitResult {
        operationsUntilPrune += 1;
        if (operationsUntilPrune >= 512 || hits.size > maxTrackedKeys) {
            operationsUntilPrune = 0;
            prune(now);
        }

        const timestamps = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

        if (timestamps.length >= max) {
            hits.set(key, timestamps);
            return { allowed: false, retryAfterMs: Math.max(0, windowMs - (now - timestamps[0])) };
        }

        timestamps.push(now);
        hits.set(key, timestamps);
        return { allowed: true, retryAfterMs: 0 };
    }

    return { check };
}
