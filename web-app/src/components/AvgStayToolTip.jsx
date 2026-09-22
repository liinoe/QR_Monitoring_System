export const buildAvgStayTooltip = (exitedCount, totalStayMs, avgStay, excludedCount = 0) => {
  if (exitedCount === 0) {
    return "No completed visits in this view yet, so there's nothing to average.";
  }

  const totalHours = (totalStayMs / (1000 * 60 * 60)).toFixed(1);
  const visitWord = exitedCount === 1 ? "visit" : "visits";
  const excludedNote = excludedCount > 0
    ? ` ${excludedCount} more exit${excludedCount === 1 ? " was" : "s were"} forced (via "Force Exit All" or the 5:01 PM auto-logout) and excluded, since those don't reflect an actual exit time.`
    : "";

  return `Based on ${exitedCount} completed ${visitWord} totaling ${totalHours} hr, for a ${avgStay} hr average.${excludedNote}`;
};