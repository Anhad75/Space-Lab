// Mission verdict: hard gates first, then the weighted score.
// A lander that dies in the dark or can never phone home is never "viable",
// however good its other numbers are.
import { fmtDuration } from "./format.js";

export const LEVELS = {
  viable: { status: "good", label: "Viable" },
  marginal: { status: "warning", label: "Marginal" },
  poor: { status: "poor", label: "Poor" },
  relay: { status: "serious", label: "Needs relay" },
  fails: { status: "critical", label: "Fails" },
};

/**
 * m: { longestDarkH, earthPct, longestNoCommH }, score: 0-100
 * limits: { batteryHours, maxBlackoutHours }
 */
export function assess(m, score, { batteryHours, maxBlackoutHours }) {
  let kind, reason;
  if (m.longestDarkH > batteryHours) {
    kind = "fails";
    reason = `${fmtDuration(m.longestDarkH)} night > ${batteryHours} h battery`;
  } else if (m.earthPct <= 0) {
    kind = "relay";
    reason = "Earth never in view";
  } else if (m.longestNoCommH > maxBlackoutHours) {
    kind = "relay";
    reason = `${fmtDuration(m.longestNoCommH)} blackout > ${maxBlackoutHours} h limit`;
  } else if (score >= 70) {
    kind = "viable";
    reason = "Within battery and comm limits";
  } else if (score >= 45) {
    kind = "marginal";
    reason = "Within limits, but low sunlight or Earth time";
  } else {
    kind = "poor";
    reason = "Within limits, but little sunlight or Earth time";
  }
  // gated verdicts carry no score: the number would hide the reason
  const gated = kind === "fails" || kind === "relay";
  return { kind, ...LEVELS[kind], reason, score: gated ? null : score };
}
