export interface RaceStrategyResult {
  status: string;
  action: string;
  risk: string;
  confidence: number;
  pitWindow: string;
  engineerMessage: string;
}

export function getRaceStrategyRecommendation(
  degradation: number,
  consistency: number,
  lapsCompleted: number
): RaceStrategyResult {

  let action = "Continue current stint";
  let risk = "LOW";
  let confidence = 95;
  let status = "Stable";

  if (
    degradation > 1.5 ||
    consistency > 0.8
  ) {
    action = "Pit within next 3 laps";
    risk = "HIGH";
    confidence = 88;
    status = "Critical";
  }

  else if (
    degradation > 0.8 ||
    consistency > 0.5
  ) {
    action = "Prepare pit strategy";
    risk = "MEDIUM";
    confidence = 91;
    status = "Monitor";
  }

  let engineerMessage = "";

if (risk === "LOW") {
  engineerMessage =
    "Tyre degradation remains under control and pace consistency is strong. Continue the current stint while monitoring track evolution.";
} else if (risk === "MEDIUM") {
  engineerMessage =
    "Performance is beginning to decline. Prepare the pit crew and monitor lap time loss over the next few laps.";
} else {
  engineerMessage =
    "Tyre performance has dropped significantly. An early pit stop is recommended to minimize further time loss.";
}

  return {

    status,

    action,

    risk,

    confidence,

    pitWindow: `Lap ${lapsCompleted + 2}-${lapsCompleted + 5}`,

    engineerMessage,

  };

}