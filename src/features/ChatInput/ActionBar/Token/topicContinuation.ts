interface ContinuationMessage {
  content: string | null;
  role: string;
}

/** Bounded rolling summaries: never send an entire large topic to the summarizer. */
export const summarizeTopicInChunks = async (
  messages: ContinuationMessage[],
  summarize: (text: string, previousSummary: string) => Promise<string>,
  signal: AbortSignal,
  onProgress: (current: number, total: number) => void,
): Promise<string> => {
  const text = messages
    .map((message) =>
      JSON.stringify({
        role: message.role,
        content: message.content,
        // Keep source references without hydrating old attachments into the next topic.
      }),
    )
    .join('\n');
  if (!text.trim()) throw new Error('No conversation to summarize');
  const chunkSize = 32_000;
  const total = Math.ceil(text.length / chunkSize);
  let summary = '';
  for (let offset = 0; offset < text.length; offset += chunkSize) {
    signal.throwIfAborted();
    onProgress(offset / chunkSize + 1, total);
    summary = await summarize(text.slice(offset, offset + chunkSize), summary);
    signal.throwIfAborted();
    if (!summary.trim()) throw new Error('Empty continuation summary');
    // Do not silently truncate a failed/broken summarizer response.
    if (summary.length > 24_000) throw new Error('Continuation summary exceeds its budget');
  }
  return summary;
};
