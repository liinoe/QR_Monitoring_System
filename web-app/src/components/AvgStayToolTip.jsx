// Builds the hover text for the "Avg. Stay Duration" card: how many visits were
// averaged, and how many forced exits (Force Exit All / 5:31 PM auto-logout)
// were left out because they don't show when the student really left.
// (_totalStayMs and _avgStay are still passed in by the pages but no longer shown.)
export const buildAvgStayTooltip = (exitedCount, _totalStayMs, _avgStay, excludedCount = 0) => {
  if (exitedCount === 0) {
    return "No one has logged out yet, so there's no average yet.";
  }

  const visitWord = exitedCount === 1 ? "visit" : "visits";
  const excludedNote = excludedCount > 0
    ? ` ${excludedCount} visit${excludedCount === 1 ? " was" : "s were"} not counted because the system logged ${excludedCount === 1 ? "that person" : "them"} out automatically (5:31 PM or Force Exit All), so the real leaving time is unknown.`
    : "";

  return `How long people usually stay, from ${exitedCount} ${visitWord} (time in to time out).${excludedNote}`;
};