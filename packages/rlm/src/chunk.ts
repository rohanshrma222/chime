/**
 * Naive fixed-size chunking with overlap, so a fact split across a chunk
 * boundary still appears whole in at least one chunk. Token-aware chunking
 * (splitting on sentence/paragraph boundaries) is a later refinement.
 */
export function chunkText(text: string, maxChars: number, overlapChars = 200): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const overlap = Math.min(overlapChars, Math.floor(maxChars / 2));
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}
