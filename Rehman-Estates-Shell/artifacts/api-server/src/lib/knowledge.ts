type Chunk = {
  id: string;
  topic: string;
  keywords?: string[];
  text: string;
};

function normalizeQuestion(q: string): string {
  return String(q)
    .toLowerCase()
    .replace(/[.,;:!?'"()\-_/\\[\]{}؟۔،؛«»٪…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same keyword scoring as the voice-agent tools.js handler. */
export function bestChunk(chunks: Chunk[], question: string): Chunk | null {
  const q = normalizeQuestion(question);
  let best: Chunk | null = null;
  let bestScore = 0;
  for (const chunk of chunks) {
    let score = 0;
    for (const kw of chunk.keywords || []) {
      if (q.includes(String(kw).toLowerCase())) score += 3;
    }
    for (const word of String(chunk.topic || "")
      .toLowerCase()
      .split(/\s+/)) {
      if (word.length >= 3 && q.includes(word)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = chunk;
    }
  }
  return bestScore > 0 ? best : null;
}
