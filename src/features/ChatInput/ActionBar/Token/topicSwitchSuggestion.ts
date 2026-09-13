/** Conservative explicit-intent detection; this does not classify arbitrary topic similarity. */
export const hasExplicitTopicSwitch = (draft: string): boolean => {
  // Only inspect the user's opening sentence. Quoted history, pasted documents and code
  // must not trigger a suggestion merely because they contain a matching phrase.
  const opening = draft.trimStart().slice(0, 160);
  return (
    /^(?:(?:我们|咱们|我想|现在|接下来)[，,\s]*)?(?:换(?:个|一个)话题|换(?:个|一个)问题|另外?(?:一个|个)不相关的问题|问(?:个|一个)不相关的问题|先不聊这个了?|先不讨论这个了?)(?=$|[\s，,。.!！?？:：])/u.test(
      opening,
    ) ||
    /^(?:let['’]s\s+(?:change|switch)\s+(?:the\s+)?(?:topics?|subjects?)|(?:an?\s+)?unrelated\s+question|on\s+(?:an?\s+)?unrelated\s+note)(?=$|[\s,.!?:])/iu.test(
      opening,
    )
  );
};
