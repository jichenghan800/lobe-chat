import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { GoogleGenAIOptions } from '@google/genai';
import type { LobeChatDatabase } from '@lobechat/database';
import type { OpenAIChatMessage, UserMessageContentPart } from '@lobechat/types';
import { importPKCS8, SignJWT } from 'jose';

import { FileModel } from '@/database/models/file';
import { FileService } from '@/server/services/file';

export const VERTEX_NATIVE_PDF_MIME_TYPE = 'application/pdf';

const DEFAULT_VERTEX_BUCKET = 'lobechat-cotti';
const DEFAULT_VERTEX_LOCATION = 'global';
const STORAGE_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

interface ResolvedCredentials {
  credentials?: Record<string, unknown>;
  project?: string;
}

interface ServiceAccountCredentials extends Record<string, unknown> {
  client_email?: string;
  private_key?: string;
  private_key_id?: string;
  token_uri?: string;
  type?: string;
}

interface EnsureVertexPdfGcsUriParams {
  bucket?: string;
  bytes: Uint8Array;
  fileHash?: string | null;
  fileName: string;
  objectKey?: string;
  vertexOptions: GoogleGenAIOptions;
}

interface PrepareVertexNativePdfMessagesParams {
  bucket?: string;
  messages: OpenAIChatMessage[];
  serverDB: LobeChatDatabase;
  userId: string;
}

type FileUrlPart = Extract<UserMessageContentPart, { type: 'file_url' }>;
type TextPart = Extract<UserMessageContentPart, { type: 'text' }>;

const safeParseJSON = (value: string | undefined): Record<string, unknown> | undefined => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const resolveCredentialsFromEnv = async (): Promise<ResolvedCredentials> => {
  const credentialsFromEnv = safeParseJSON(process.env.VERTEXAI_CREDENTIALS);
  if (credentialsFromEnv) {
    return {
      credentials: credentialsFromEnv,
      project:
        typeof credentialsFromEnv.project_id === 'string'
          ? credentialsFromEnv.project_id
          : undefined,
    };
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) return {};

  const rawCredentials = await readFile(path.resolve(credentialsPath), 'utf8');
  const credentialsFromFile = safeParseJSON(rawCredentials);

  if (!credentialsFromFile) {
    throw new Error(`Failed to parse GOOGLE_APPLICATION_CREDENTIALS from ${credentialsPath}`);
  }

  return {
    credentials: credentialsFromFile,
    project:
      typeof credentialsFromFile.project_id === 'string'
        ? credentialsFromFile.project_id
        : undefined,
  };
};

export const buildVertexGenAIOptionsFromEnv = async (
  overrides: Partial<GoogleGenAIOptions> = {},
): Promise<GoogleGenAIOptions> => {
  const { credentials, project: projectFromCredentials } = await resolveCredentialsFromEnv();

  const project =
    (overrides.project as string | undefined) ||
    process.env.VERTEXAI_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    projectFromCredentials;

  if (!project) {
    throw new Error(
      'Missing Vertex project. Set VERTEXAI_PROJECT or include project_id in VERTEXAI_CREDENTIALS.',
    );
  }

  const location =
    (overrides.location as string | undefined) ||
    process.env.VERTEXAI_LOCATION ||
    process.env.GOOGLE_CLOUD_LOCATION ||
    DEFAULT_VERTEX_LOCATION;

  const options: GoogleGenAIOptions = {
    ...overrides,
    location,
    project,
    vertexai: true,
  };

  if (credentials) {
    options.googleAuthOptions = {
      ...overrides.googleAuthOptions,
      credentials,
    };
  }

  return options;
};

const getAccessToken = async (vertexOptions: GoogleGenAIOptions): Promise<string> => {
  const credentials = vertexOptions.googleAuthOptions?.credentials as
    | ServiceAccountCredentials
    | undefined;

  if (!credentials) {
    throw new Error(
      'Missing service account credentials for Vertex PDF GCS sync. Set VERTEXAI_CREDENTIALS.',
    );
  }

  if (credentials.type !== 'service_account') {
    throw new Error(
      `Unsupported Google credential type for Vertex PDF GCS sync: ${credentials.type || 'unknown'}`,
    );
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('VERTEXAI_CREDENTIALS must include client_email and private_key');
  }

  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const key = await importPKCS8(credentials.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({ scope: STORAGE_SCOPE })
    .setProtectedHeader({
      alg: 'RS256',
      ...(credentials.private_key_id ? { kid: credentials.private_key_id } : {}),
      typ: 'JWT',
    })
    .setIssuer(credentials.client_email)
    .setSubject(credentials.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch(tokenUri, {
    body: new URLSearchParams({
      assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(
      `Failed to acquire Google access token for Vertex PDF GCS sync (${response.status}): ${await response.text()}`,
    );
  }

  const result = (await response.json()) as { access_token?: string };
  if (!result.access_token) {
    throw new Error('Google OAuth token response did not include access_token');
  }

  return result.access_token;
};

const toObjectMetadataUrl = (bucket: string, objectKey: string) =>
  `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectKey)}`;

const toObjectUploadUrl = (bucket: string, objectKey: string) =>
  `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
    bucket,
  )}/o?uploadType=media&name=${encodeURIComponent(objectKey)}`;

const normalizeFileName = (fileName: string) => {
  const normalized = path.basename(fileName).replaceAll(/[^\w.-]/g, '_');
  return normalized || 'document.pdf';
};

const resolveObjectKey = ({
  fileHash,
  fileName,
  objectKey,
  bytes,
}: {
  bytes: Uint8Array;
  fileHash?: string | null;
  fileName: string;
  objectKey?: string;
}) => {
  if (objectKey) return objectKey;

  const hash = fileHash || createHash('sha256').update(bytes).digest('hex');
  return `vertex-native-pdf/chat-upload/${hash}/${normalizeFileName(fileName)}`;
};

const isGsUri = (url: string) => url.startsWith('gs://');

const escapeRegExp = (value: string) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isTextPart = (part: UserMessageContentPart | undefined): part is TextPart =>
  part?.type === 'text';

export const stripNativePdfFallbackPrompt = (
  text: string,
  nativePdfParts: FileUrlPart[],
): string => {
  let nextText = text;

  for (const part of nativePdfParts) {
    const mimeType = part.file_url.mimeType || VERTEX_NATIVE_PDF_MIME_TYPE;
    const escapedMimeType = escapeRegExp(mimeType);
    const escapedId = part.file_url.id ? escapeRegExp(part.file_url.id) : undefined;
    const escapedName = part.file_url.name ? escapeRegExp(part.file_url.name) : undefined;

    if (escapedId) {
      nextText = nextText.replaceAll(
        new RegExp(
          `<file\\b[^>]*\\bid="${escapedId}"(?:[^>]*\\btype="${escapedMimeType}")?[^>]*>([\\s\\S]*?)<\\/file>\\s*`,
          'g',
        ),
        '',
      );
      nextText = nextText.replaceAll(
        new RegExp(
          `<file\\b[^>]*\\bid="${escapedId}"(?:[^>]*\\btype="${escapedMimeType}")?[^>]*/>\\s*`,
          'g',
        ),
        '',
      );
      continue;
    }

    if (escapedName) {
      nextText = nextText.replaceAll(
        new RegExp(
          `<file\\b[^>]*\\bname="${escapedName}"(?:[^>]*\\btype="${escapedMimeType}")?[^>]*>([\\s\\S]*?)<\\/file>\\s*`,
          'g',
        ),
        '',
      );
      nextText = nextText.replaceAll(
        new RegExp(
          `<file\\b[^>]*\\bname="${escapedName}"(?:[^>]*\\btype="${escapedMimeType}")?[^>]*/>\\s*`,
          'g',
        ),
        '',
      );
    }
  }

  nextText = nextText
    .replaceAll(
      /<files>\s*<files_docstring>here are user upload files you can refer to<\/files_docstring>\s*<\/files>\s*/g,
      '',
    )
    .replaceAll(/<files_info>\s*<\/files_info>\s*/g, '')
    .replaceAll(/<files\b[^>]*>\s*<\/files>\s*/g, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();

  return nextText;
};

export const isVertexNativePdfPart = (
  part: UserMessageContentPart | undefined,
): part is FileUrlPart => {
  return (
    part?.type === 'file_url' &&
    part.file_url.mimeType?.toLowerCase() === VERTEX_NATIVE_PDF_MIME_TYPE
  );
};

export const ensureVertexPdfGcsUri = async ({
  bytes,
  fileHash,
  fileName,
  objectKey,
  vertexOptions,
  bucket = process.env.VERTEX_PDF_NATIVE_BUCKET || DEFAULT_VERTEX_BUCKET,
}: EnsureVertexPdfGcsUriParams): Promise<string> => {
  const resolvedObjectKey = resolveObjectKey({ bytes, fileHash, fileName, objectKey });
  const gcsUri = `gs://${bucket}/${resolvedObjectKey}`;
  const accessToken = await getAccessToken(vertexOptions);

  const metadataResponse = await fetch(toObjectMetadataUrl(bucket, resolvedObjectKey), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (metadataResponse.ok) return gcsUri;

  if (metadataResponse.status !== 404) {
    throw new Error(
      `Failed to query Vertex PDF GCS object (${metadataResponse.status}): ${await metadataResponse.text()}`,
    );
  }

  const uploadResponse = await fetch(toObjectUploadUrl(bucket, resolvedObjectKey), {
    body: Buffer.from(bytes),
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Length': String(bytes.byteLength),
      'Content-Type': VERTEX_NATIVE_PDF_MIME_TYPE,
    },
    method: 'POST',
  });

  if (!uploadResponse.ok) {
    throw new Error(
      `Failed to upload Vertex PDF to GCS (${uploadResponse.status}): ${await uploadResponse.text()}`,
    );
  }

  return gcsUri;
};

const resolveBytesFromFilePart = async (
  filePart: FileUrlPart,
  fileModel: FileModel,
  fileService: FileService,
): Promise<{ bytes: Uint8Array; fileHash?: string | null; fileName: string } | undefined> => {
  const fileId = filePart.file_url.id;

  if (fileId) {
    const file = await fileModel.findById(fileId);
    if (file?.url) {
      const bytes = await fileService.getFileByteArray(file.url);

      return {
        bytes,
        fileHash: file.fileHash,
        fileName: file.name,
      };
    }
  }

  const sourceUrl = filePart.file_url.url;
  if (!sourceUrl || isGsUri(sourceUrl)) return undefined;

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch PDF from ${sourceUrl}: ${response.status} ${response.statusText}`,
    );
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    fileHash: undefined,
    fileName: filePart.file_url.name || 'document.pdf',
  };
};

export const prepareVertexNativePdfMessages = async ({
  messages,
  serverDB,
  userId,
  bucket,
}: PrepareVertexNativePdfMessagesParams): Promise<OpenAIChatMessage[]> => {
  const hasVertexPdfPart = messages.some(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some((part) => isVertexNativePdfPart(part as UserMessageContentPart)),
  );

  if (!hasVertexPdfPart) return messages;

  let vertexOptions: GoogleGenAIOptions;
  try {
    vertexOptions = await buildVertexGenAIOptionsFromEnv();
  } catch (error) {
    console.error('[vertex-native-pdf] Failed to resolve Vertex options:', error);
    return messages;
  }

  const fileModel = new FileModel(serverDB, userId);
  const fileService = new FileService(serverDB, userId);
  let hasChanges = false;

  const nextMessages = await Promise.all(
    messages.map(async (message) => {
      if (!Array.isArray(message.content)) return message;

      const preparedContent = await Promise.all(
        message.content.map(async (part) => {
          if (!isVertexNativePdfPart(part)) return part;
          if (isGsUri(part.file_url.url)) return part;

          try {
            const fileData = await resolveBytesFromFilePart(part, fileModel, fileService);
            if (!fileData) return part;

            const gcsUri = await ensureVertexPdfGcsUri({
              bucket,
              bytes: fileData.bytes,
              fileHash: fileData.fileHash,
              fileName: fileData.fileName,
              vertexOptions,
            });

            hasChanges = true;

            return {
              ...part,
              file_url: {
                ...part.file_url,
                url: gcsUri,
              },
            };
          } catch (error) {
            console.error('[vertex-native-pdf] Failed to prepare PDF part:', error);
            return part;
          }
        }),
      );

      const nativePdfParts = preparedContent.filter((part) =>
        isVertexNativePdfPart(part as UserMessageContentPart),
      ) as FileUrlPart[];
      const readyNativePdfParts = nativePdfParts.filter((part) => isGsUri(part.file_url.url));

      let messageChanged = preparedContent !== message.content;
      const nextContent =
        readyNativePdfParts.length === 0
          ? preparedContent
          : preparedContent.map((part) => {
              const typedPart = part as UserMessageContentPart;
              if (!isTextPart(typedPart)) return part;

              const nextText = stripNativePdfFallbackPrompt(typedPart.text, readyNativePdfParts);
              if (nextText !== typedPart.text) messageChanged = true;

              return {
                ...part,
                text: nextText,
              };
            });

      if (messageChanged) hasChanges = true;

      return messageChanged ? { ...message, content: nextContent } : message;
    }),
  );

  return hasChanges ? nextMessages : messages;
};
