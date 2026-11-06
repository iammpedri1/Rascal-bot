import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, release, arch } from "node:os";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { join } from "node:path";
import { normalizeContent as normalizeTypeScript } from "../utils/textNormalizer";

type Normalizer = (content: string) => string;
type Summary = {
  operations: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  operationsPerSecond: number;
};

const nodeRequire = createRequire(__filename);
const rounds = 20;
const operationsPerRound = 50_000;
const corpus = [
  "  Olá, MUNDO!  ",
  "mensagem com acentuação e emoji 🦝",
  "texto curto para o caminho quente do AutoMod",
  "  URLs e símbolos: https://example.test/a?b=1  ",
  "Unicode composto: Cafe\u0301, São Paulo, Привет",
];

function percentile(values: number[], rank: number): number {
  const index = Math.min(values.length - 1, Math.ceil(values.length * rank) - 1);
  return values[index];
}

function measure(normalizer: Normalizer): Summary {
  for (let index = 0; index < 5_000; index += 1) {
    normalizer(corpus[index % corpus.length]);
  }

  const samples: number[] = [];
  let checksum = 0;
  for (let round = 0; round < rounds; round += 1) {
    const started = performance.now();
    for (let index = 0; index < operationsPerRound; index += 1) {
      checksum += normalizer(corpus[index % corpus.length]).length;
    }
    samples.push(performance.now() - started);
  }

  if (checksum <= 0) throw new Error("Benchmark inválido: checksum vazio.");
  samples.sort((left, right) => left - right);
  const medianMs = percentile(samples, 0.5);
  return {
    operations: rounds * operationsPerRound,
    medianMs,
    p95Ms: percentile(samples, 0.95),
    p99Ms: percentile(samples, 0.99),
    operationsPerSecond: operationsPerRound / (medianMs / 1000),
  };
}

function loadNative(): Normalizer | null {
  try {
    const bindingPath = join(process.cwd(), "native", "rascal-native.js");
    const binding = nodeRequire(bindingPath) as { normalizeContent?: Normalizer };
    return typeof binding.normalizeContent === "function" ? binding.normalizeContent : null;
  } catch {
    return null;
  }
}

function format(summary: Summary): string {
  return `${summary.operationsPerSecond.toFixed(0)} ops/s, mediana ${summary.medianMs.toFixed(3)} ms`;
}

const native = loadNative();
const result = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  rust: readFileSync(join(process.cwd(), "rust", "Cargo.toml"), "utf8")
    .match(/rust-core|rascal-core/)?.[0] ?? "rascal-core",
  host: {
    platform: platform(),
    release: release(),
    arch: arch(),
    cpu: cpus()[0]?.model ?? "unknown",
  },
  corpusSize: corpus.length,
  rounds,
  operationsPerRound,
  typescript: measure((content) => normalizeTypeScript(content)),
  native: native ? measure(native) : null,
};

mkdirSync(join(process.cwd(), "docs", "performance"), { recursive: true });
writeFileSync(
  join(process.cwd(), "docs", "performance", "text-normalizer.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
writeFileSync(
  join(process.cwd(), "docs", "performance", "RESULTS-text-normalizer.md"),
  [
    "# Benchmark: normalização de texto",
    "",
    `- Node: ${result.node}`,
    `- Host: ${result.host.platform} ${result.host.arch}; ${result.host.cpu}`,
    `- Corpus: ${result.corpusSize} entradas; ${result.rounds} rodadas de ${result.operationsPerRound} operações`,
    "",
    "| Caminho | Throughput | Mediana | P95 | P99 |",
    "|---|---:|---:|---:|---:|",
    `| TypeScript | ${format(result.typescript)} | ${result.typescript.medianMs.toFixed(3)} ms | ${result.typescript.p95Ms.toFixed(3)} ms | ${result.typescript.p99Ms.toFixed(3)} ms |`,
    result.native
      ? `| N-API/Rust | ${format(result.native)} | ${result.native.medianMs.toFixed(3)} ms | ${result.native.p95Ms.toFixed(3)} ms | ${result.native.p99Ms.toFixed(3)} ms |`
      : "| N-API/Rust | addon não compilado | - | - | - |",
    "",
    "O benchmark mede a função e a fronteira N-API, mas não representa sozinho o caminho completo de `messageCreate`.",
    "O resultado não habilita Rust automaticamente; a decisão deve considerar paridade, overhead e o caminho end-to-end.",
    "",
  ].join("\n"),
);

console.log(`TypeScript: ${format(result.typescript)}`);
console.log(result.native ? `N-API/Rust: ${format(result.native)}` : "N-API/Rust: addon não compilado");
