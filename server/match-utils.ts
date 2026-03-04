const DEFAULT_DURATION_MINUTES = 120;

export function normalizeMatchStatus(match: any): any {
  if (match.status === "CANCELLED") return match;

  const now = new Date();
  const startTime = match.startTime ? new Date(match.startTime) : null;
  const endTime = match.endTime
    ? new Date(match.endTime)
    : startTime
      ? new Date(startTime.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000)
      : null;

  const hasScore = match.homeScore != null && match.awayScore != null;
  const isPlayed = match.statsEntered || match.scoreLocked ||
    (match.scoreSource && match.scoreSource !== "NONE") || hasScore;

  let computedStatus: string;

  if (isPlayed) {
    computedStatus = "PLAYED";
  } else if (!startTime) {
    computedStatus = match.status || "UPCOMING";
  } else if (now < startTime) {
    computedStatus = "UPCOMING";
  } else if (endTime && now >= startTime && now <= endTime) {
    computedStatus = "LIVE";
  } else {
    computedStatus = "PAST_NO_SCORE";
  }

  return { ...match, status: computedStatus, endTime: endTime };
}

export function addCountdown(match: any): any {
  if (match.status !== "UPCOMING" || !match.startTime) return match;

  const now = new Date();
  const start = new Date(match.startTime);
  const diffMs = start.getTime() - now.getTime();

  if (diffMs <= 0) return { ...match, timeLeftSeconds: 0, timeLeftLabel: "Starting now" };

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  let label = "";
  if (days > 0) label = `${days} day${days !== 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""}`;
  else if (hours > 0) label = `${hours} hour${hours !== 1 ? "s" : ""} ${minutes} min${minutes !== 1 ? "s" : ""}`;
  else label = `${minutes} min${minutes !== 1 ? "s" : ""}`;

  return { ...match, timeLeftSeconds: totalSeconds, timeLeftLabel: label };
}

export function enrichMatch(match: any): any {
  return addCountdown(normalizeMatchStatus(match));
}
