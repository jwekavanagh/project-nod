import discoveryAcquisition from "@/lib/discoveryAcquisition";

/** First sentence of `visitorProblemAnswer` (split after first `.`, `!`, or `?` plus boundary). */
export function visitorProblemFirstSentence(
  visitorProblemAnswer: string = discoveryAcquisition.visitorProblemAnswer,
): string {
  const t = visitorProblemAnswer.trim();
  const m = t.match(/^(.+?[.!?])(?:\s|$)/);
  return m ? m[1].trim() : t.split(/\n/)[0]?.trim() ?? "";
}
