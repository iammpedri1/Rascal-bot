import assert from "node:assert/strict";
import test from "node:test";
import { collectRuntimeMetrics, describeMetrics, formatBytes } from "../utils/runtimeMetrics";

test("formatBytes scales across units", () => {
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(1024), "1.0 KB");
    assert.equal(formatBytes(1536), "1.5 KB");
    assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
    assert.equal(formatBytes(150 * 1024 * 1024), "150 MB");
    assert.equal(formatBytes(2 * 1024 ** 3), "2.0 GB");
});

test("formatBytes tolerates invalid input", () => {
    assert.equal(formatBytes(-1), "0 B");
    assert.equal(formatBytes(Number.NaN), "0 B");
});

test("collectRuntimeMetrics returns non-negative byte counts", () => {
    const metrics = collectRuntimeMetrics();

    for (const value of Object.values(metrics)) {
        assert.equal(Number.isFinite(value), true);
        assert.equal(value >= 0, true);
    }
    assert.equal(metrics.heapUsedBytes <= metrics.heapTotalBytes, true);
});

test("describeMetrics summarises the runtime footprint", () => {
    const text = describeMetrics({
        rssBytes: 100 * 1024 * 1024,
        heapUsedBytes: 20 * 1024 * 1024,
        heapTotalBytes: 30 * 1024 * 1024,
        externalBytes: 1024 * 1024,
    });

    assert.match(text, /RAM 100 MB/);
    assert.match(text, /heap 20\.0 MB\/30\.0 MB/);
});
