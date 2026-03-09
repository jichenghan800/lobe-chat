import { describe, expect, it } from 'vitest';

import { stripNativePdfFallbackPrompt } from './vertexNativePdf';

describe('stripNativePdfFallbackPrompt', () => {
  it('removes matching PDF fallback file prompts after native gs uri is ready', () => {
    const text = `<!-- SYSTEM CONTEXT (NOT PART OF USER QUERY) -->
<context.instruction>following part contains context information injected by the system. Please follow these instructions:

1. Always prioritize handling user-visible content.
2. the context is only required when user's queries rely on it.
</context.instruction>
<files_info>
<files>
<files_docstring>here are user upload files you can refer to</files_docstring>
<file id="pdf-1" name="license.pdf" type="application/pdf" size="1024" url="https://example.com/license.pdf"></file>
<file id="txt-1" name="note.txt" type="text/plain" size="12" url="https://example.com/note.txt">keep me</file>
</files>
</files_info>
<!-- END SYSTEM CONTEXT -->`;

    const result = stripNativePdfFallbackPrompt(text, [
      {
        file_url: {
          id: 'pdf-1',
          mimeType: 'application/pdf',
          name: 'license.pdf',
          url: 'gs://lobechat-cotti/native/license.pdf',
        },
        type: 'file_url',
      },
    ]);

    expect(result).not.toContain('license.pdf');
    expect(result).toContain('note.txt');
    expect(result).toContain('keep me');
  });

  it('removes empty files containers left behind by stripped native pdf prompts', () => {
    const text = `<files_info>
<files>
<files_docstring>here are user upload files you can refer to</files_docstring>
<file id="pdf-1" name="license.pdf" type="application/pdf" size="1024" url="https://example.com/license.pdf"></file>
</files>
</files_info>`;

    const result = stripNativePdfFallbackPrompt(text, [
      {
        file_url: {
          id: 'pdf-1',
          mimeType: 'application/pdf',
          name: 'license.pdf',
          url: 'gs://lobechat-cotti/native/license.pdf',
        },
        type: 'file_url',
      },
    ]);

    expect(result).toBe('');
  });

  it('removes agent knowledge pdf fallback blocks after native gs uri is ready', () => {
    const text = `<agent_knowledge>
<instruction>The following files are available. Refer to their content directly to answer questions. No knowledge bases are associated.</instruction>
<files totalCount="1">
<file id="pdf-1" name="license.pdf">
Extracted OCR text that should be ignored after native PDF succeeds.
</file>
</files>
</agent_knowledge>`;

    const result = stripNativePdfFallbackPrompt(text, [
      {
        file_url: {
          id: 'pdf-1',
          mimeType: 'application/pdf',
          name: 'license.pdf',
          url: 'gs://lobechat-cotti/native/license.pdf',
        },
        type: 'file_url',
      },
    ]);

    expect(result).not.toContain('license.pdf');
    expect(result).not.toContain('<files totalCount=');
    expect(result).toContain('<agent_knowledge>');
  });
});
