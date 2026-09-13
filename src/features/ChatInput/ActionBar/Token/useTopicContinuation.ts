import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { messageService } from '@/services/message';
import { topicService } from '@/services/topic';
import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';

import { saveDraft } from '../../draftStorage';
import { useStoreApi } from '../../store';
import { summarizeTopicInChunks } from './topicContinuation';

export const useTopicContinuation = (agentId: string, navigate: (path: string) => void) => {
  const { t } = useTranslation('chat');
  const input = useStoreApi();
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  useEffect(() => () => controller.current?.abort(), []);

  const open = async (carryProgress: boolean) => {
    if (controller.current) return;
    const sourceId = useChatStore.getState().activeTopicId;
    if (!sourceId || input.getState().sendButtonProps?.generating) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    let createdId: string | undefined;
    let ready = false;
    try {
      const source = topicSelectors.getTopicById(sourceId)(useChatStore.getState());
      const config = agentSelectors.getAgentConfigById(agentId)(useAgentStore.getState());
      const model = source?.model || config.model;
      const provider = source?.provider || config.provider;
      if (!model || !provider) throw new Error('Topic model is not available');
      let summary = '';
      if (carryProgress) {
        const messages = [];
        for (let offset = 0; ; offset += 500) {
          abort.signal.throwIfAborted();
          const page = await topicService.getTopicTranscript(sourceId, offset);
          messages.push(...page.items.filter((message) => !message.threadId));
          if (offset + page.items.length >= (page.total ?? 0)) break;
          if (!page.items.length) throw new Error('Incomplete topic transcript');
        }
        const unique = [...new Map(messages.map((message) => [message.id, message])).values()];
        unique.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        summary = await summarizeTopicInChunks(
          unique,
          (text, previous) =>
            topicService.summarizeContinuationFragment(
              { topicId: sourceId, model, provider, text, previous },
              abort.signal,
            ),
          abort.signal,
          (current, total) => setProgress(t('longTopic.summarizing', { current, total })),
        );
      }
      abort.signal.throwIfAborted();
      // A slow summary must never navigate away from a different conversation or a new run.
      if (
        useChatStore.getState().activeTopicId !== sourceId ||
        input.getState().sendButtonProps?.generating
      )
        throw new Error('Conversation changed while preparing continuation');
      createdId = await topicService.createTopic({
        agentId,
        model,
        provider,
        title: carryProgress
          ? t('longTopic.continuedTitle', { title: source?.title || t('longTopic.newQuestion') })
          : t('longTopic.newQuestion'),
      });
      if (carryProgress)
        await messageService.createMessage({
          agentId,
          topicId: createdId,
          role: 'user',
          content: t('longTopic.handoff', {
            source: `/agent/${encodeURIComponent(agentId)}/${encodeURIComponent(sourceId)}`,
            summary,
          }),
        });
      abort.signal.throwIfAborted();
      if (
        useChatStore.getState().activeTopicId !== sourceId ||
        input.getState().sendButtonProps?.generating
      )
        throw new Error('Conversation changed while preparing continuation');
      // Read the latest draft after summarization; edits made while waiting are retained.
      const draft = input.getState().getJSONState();
      if (draft && input.getState().getMarkdownContent().trim()) {
        const targetKey = messageMapKey({ agentId, topicId: createdId });
        if (saveDraft(targetKey, draft) === undefined) throw new Error('Could not preserve draft');
      }
      ready = true;
      await useChatStore.getState().refreshTopic();
      abort.signal.throwIfAborted();
      if (
        useChatStore.getState().activeTopicId !== sourceId ||
        input.getState().sendButtonProps?.generating
      )
        throw new Error('Conversation changed while preparing continuation');
      await useChatStore.getState().switchTopic(createdId);
      navigate(`/agent/${encodeURIComponent(agentId)}/${encodeURIComponent(createdId)}`);
    } catch (error) {
      // Only delete our unfinished new topic; the source remains untouched.
      if (createdId && !ready) {
        try {
          await topicService.removeTopic(createdId);
        } catch (cleanupError) {
          console.error('[TopicContinuation] cleanup failed', cleanupError);
        }
      }
      throw error;
    } finally {
      controller.current = null;
      setBusy(false);
      setProgress('');
    }
  };
  return { busy, cancel: () => controller.current?.abort(), open, progress };
};
