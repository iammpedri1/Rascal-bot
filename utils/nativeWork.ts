import { createRequire } from "node:module";
import { join } from "node:path";

export interface WorkRoll {
  event: "dismissal" | "tool_break" | "success" | "critical";
  professionIndex: number;
  baseReward: number;
  loss: number;
  bonus: number;
  critical: boolean;
}

interface NativeWorkBinding {
  resolveWorkRoll(
    roll: number,
    professionRoll: number,
    rewardRoll: number,
    bonusRoll: number,
    lossRoll: number,
    toolLossRoll: number,
  ): WorkRoll;
}

const nodeRequire = createRequire(__filename);
let binding: NativeWorkBinding | null | undefined;

function loadBinding(): NativeWorkBinding | null {
  if (binding !== undefined) return binding;
  if (String(process.env.RASCAL_NATIVE_ECONOMY ?? "").toLowerCase() !== "true") {
    binding = null;
    return binding;
  }

  try {
    binding = nodeRequire(join(process.cwd(), "native", "rascal-native")) as NativeWorkBinding;
  } catch (error) {
    binding = null;
    console.warn("[nativeWork] addon Rust indisponível; usando TypeScript.", error);
  }
  return binding;
}

export function resolveNativeWorkRoll(
  values: readonly [number, number, number, number, number, number],
): WorkRoll | null {
  const native = loadBinding();
  return native?.resolveWorkRoll(...values) ?? null;
}
