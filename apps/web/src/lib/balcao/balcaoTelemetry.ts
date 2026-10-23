import type { BalcaoActionId } from "@/lib/balcao/action-registry";

export type BalcaoSafeAction = BalcaoActionId;
export type BalcaoAggregate = {
  version: 1;
  actions: Partial<Record<BalcaoSafeAction, number>>;
  latencyBuckets: { under100: number; under250: number; under500: number; over500: number };
  errors: number;
};
type Sender = (batch: BalcaoAggregate) => void | Promise<void>;
const ACTIONS = new Set<BalcaoSafeAction>(["desk","payment","document","reenrollment","enrollment","profile","grade"]);

/**
 * Zero raw events, URL, student/school/user identifiers, text, exact timestamps,
 * IP addresses, financial amounts or form values. Only known action categories
 * and integer aggregate counters are held temporarily in component memory.
 */
export function createBalcaoTelemetry(config: {
  enabled?: boolean;
  sender?: Sender; // caller must use a privacy-reviewed transport if enabled
  minFlushMs?: number;
  maxEventsPerBatch?: number;
} = {}) {
  const enabled = config.enabled === true;
  const minFlushMs = Math.max(300_000, config.minFlushMs ?? 300_000);
  const maxEvents = Math.min(1_000,Math.max(100, config.maxEventsPerBatch ?? 500));
  let lastFlush = 0;
  let total = 0;
  let batch: BalcaoAggregate = blank();
  function blank(): BalcaoAggregate {
    return {version:1,actions:{},latencyBuckets:{under100:0,under250:0,under500:0,over500:0},errors:0};
  }
  function count(event: {action: BalcaoSafeAction; durationMs?: number; error?: boolean}) {
    if (!enabled || !ACTIONS.has(event.action) || total >= maxEvents) return;
    // Enumerate ONLY whitelisted fields; ignore malicious caller extras.
    batch.actions[event.action]=(batch.actions[event.action]??0)+1;
    if (event.error===true) batch.errors++;
    if (typeof event.durationMs==="number" && Number.isFinite(event.durationMs)) {
      const ms=Math.max(0,event.durationMs);
      if(ms<100)batch.latencyBuckets.under100++;
      else if(ms<250)batch.latencyBuckets.under250++;
      else if(ms<500)batch.latencyBuckets.under500++;
      else batch.latencyBuckets.over500++;
    }
    total++;
  }
  function snapshot(): BalcaoAggregate {
    return {
      version:1,
      actions:{...batch.actions},
      latencyBuckets:{...batch.latencyBuckets},
      errors:batch.errors,
    };
  }
  async function flush(now: number) {
    // No sender = no network, no IP transfer; default safe production mode.
    if (!enabled || !config.sender || !Number.isFinite(now) || now-lastFlush<minFlushMs || total===0) return false;
    const clean=snapshot();
    await config.sender(clean);
    lastFlush=now;
    total=0;
    batch=blank();
    return true;
  }
  return { count, snapshot, flush, enabled };
}
