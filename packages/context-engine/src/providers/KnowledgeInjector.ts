import type { FileContent, KnowledgeBaseInfo } from '@lobechat/prompts';
import { promptAgentKnowledge } from '@lobechat/prompts';
import type { UserMessageContentPart } from '@lobechat/types';
import debug from 'debug';

import { BaseFirstUserContentProvider } from '../base/BaseFirstUserContentProvider';
import type { Message, PipelineContext, ProcessorOptions } from '../types';

declare module '../types' {
  interface PipelineContextMetadataOverrides {
    filesCount?: number;
    knowledgeBasesCount?: number;
    knowledgeInjected?: boolean;
  }
}

const log = debug('context-engine:provider:KnowledgeInjector');
const VERTEX_NATIVE_PDF_MIME_TYPE = 'application/pdf';

type FileUrlPart = Extract<UserMessageContentPart, { type: 'file_url' }>;

export interface KnowledgeInjectorConfig {
  /** File contents to inject */
  fileContents?: FileContent[];
  /** Knowledge bases to inject */
  knowledgeBases?: KnowledgeBaseInfo[];
  /** Model provider, used to enable provider-specific knowledge injection */
  provider?: string;
}

/**
 * Knowledge Injector
 * Responsible for injecting agent's knowledge (files and knowledge bases) into context
 * before the first user message
 */
export class KnowledgeInjector extends BaseFirstUserContentProvider {
  readonly name = 'KnowledgeInjector';

  constructor(
    private config: KnowledgeInjectorConfig,
    options: ProcessorOptions = {},
  ) {
    super(options);
  }

  private getTextualFileContents() {
    return (this.config.fileContents || []).filter((file) => !!file.error || !!file.content);
  }

  private getNativePdfParts(): FileUrlPart[] {
    if (this.config.provider !== 'vertexai') return [];

    return (this.config.fileContents || [])
      .filter(
        (file) =>
          file.fileType?.toLowerCase() === VERTEX_NATIVE_PDF_MIME_TYPE &&
          typeof file.url === 'string' &&
          file.url.length > 0,
      )
      .flatMap<FileUrlPart>((file) => {
        if (!file.url) return [];

        return [
          {
            file_url: {
              id: file.fileId,
              mimeType: file.fileType,
              name: file.filename,
              ...(typeof file.size === 'number' ? { size: file.size } : {}),
              url: file.url,
            },
            type: 'file_url',
          },
        ];
      });
  }

  private appendNativePdfParts(
    message: Message,
    nativePdfParts: FileUrlPart[],
    textContent?: string | null,
  ) {
    if (nativePdfParts.length === 0) {
      return textContent ? this.appendToMessage(message, textContent) : message;
    }

    const nextMessage = textContent ? this.appendToMessage(message, textContent) : message;
    const currentContent = nextMessage.content;

    if (typeof currentContent === 'string') {
      return {
        ...nextMessage,
        content: [{ text: currentContent, type: 'text' }, ...nativePdfParts],
        updatedAt: Date.now(),
      };
    }

    if (Array.isArray(currentContent)) {
      return {
        ...nextMessage,
        content: [...currentContent, ...nativePdfParts],
        updatedAt: Date.now(),
      };
    }

    return nextMessage;
  }

  protected buildContent(_context: PipelineContext): string | null {
    const fileContents = this.getTextualFileContents();
    const knowledgeBases = this.config.knowledgeBases || [];

    // Generate unified knowledge prompt
    const formattedContent = promptAgentKnowledge({ fileContents, knowledgeBases });

    if (!formattedContent) {
      log('No knowledge to inject');
      return null;
    }

    log(
      `Knowledge prepared: ${fileContents.length} file(s), ${knowledgeBases.length} knowledge base(s)`,
    );

    return formattedContent;
  }

  protected async doProcess(context: PipelineContext): Promise<PipelineContext> {
    const fileContents = this.config.fileContents || [];
    const knowledgeBases = this.config.knowledgeBases || [];
    const textualFileContents = this.getTextualFileContents();
    const nativePdfParts = this.getNativePdfParts();
    const formattedContent = promptAgentKnowledge({
      fileContents: textualFileContents,
      knowledgeBases,
    });

    if (!formattedContent && nativePdfParts.length === 0) {
      log('No knowledge to inject');
      return this.markAsExecuted(context);
    }

    const clonedContext = this.cloneContext(context);
    const existingIndex = this.findSystemInjectionMessageIndex(clonedContext.messages);

    if (existingIndex !== -1) {
      clonedContext.messages[existingIndex] = this.appendNativePdfParts(
        clonedContext.messages[existingIndex],
        nativePdfParts,
        formattedContent || null,
      );
    } else {
      const firstUserIndex = this.findFirstUserMessageIndex(clonedContext.messages);

      if (firstUserIndex === -1) {
        return this.markAsExecuted(clonedContext);
      }

      const injectionMessage =
        nativePdfParts.length === 0
          ? this.createSystemInjectionMessage(formattedContent)
          : {
              ...this.createSystemInjectionMessage(''),
              content: [
                ...(formattedContent ? ([{ text: formattedContent, type: 'text' }] as const) : []),
                ...nativePdfParts,
              ],
            };

      clonedContext.messages.splice(firstUserIndex, 0, injectionMessage);
    }

    if (fileContents.length > 0 || knowledgeBases.length > 0) {
      clonedContext.metadata.knowledgeInjected = true;
      clonedContext.metadata.filesCount = fileContents.length;
      clonedContext.metadata.knowledgeBasesCount = knowledgeBases.length;
    }

    return this.markAsExecuted(clonedContext);
  }
}
