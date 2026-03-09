import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { GenerateContentResponse, GoogleGenAIOptions } from '@google/genai';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';

import {
  buildVertexGenAIOptionsFromEnv,
  ensureVertexPdfGcsUri,
  VERTEX_NATIVE_PDF_MIME_TYPE,
} from './services/vertexNativePdf';

const DEFAULT_BUCKET = 'lobechat-cotti';
const DEFAULT_FILE_PATH = 'packages/file-loaders/test/fixtures/test.pdf';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_PROMPT = 'Read the PDF and reply with only the number shown in the document.';

interface CliArgs {
  bucket?: string;
  file?: string;
  gcsUri?: string;
  help: boolean;
  location?: string;
  model?: string;
  objectKey?: string;
  project?: string;
  prompt?: string;
}

interface VertexPocConfig {
  bucket: string;
  filePath: string;
  gcsUri?: string;
  model: string;
  objectKey?: string;
  prompt: string;
  vertexOptions: GoogleGenAIOptions;
}

const loadEnv = () => {
  const env = process.env.NODE_ENV || 'development';
  const envFiles = ['.env', `.env.${env}`, '.env.local', `.env.${env}.local`];

  for (let index = 0; index < envFiles.length; index += 1) {
    const path = envFiles[index];
    if (!existsSync(path)) continue;

    dotenvExpand.expand(
      dotenv.config({
        override: index > 0,
        path,
        quiet: true,
      }),
    );
  }
};

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    switch (current) {
      case '-h':
      case '--help': {
        args.help = true;
        break;
      }

      case '--bucket': {
        args.bucket = argv[++index];
        break;
      }

      case '--file': {
        args.file = argv[++index];
        break;
      }

      case '--gcs-uri': {
        args.gcsUri = argv[++index];
        break;
      }

      case '--location': {
        args.location = argv[++index];
        break;
      }

      case '--model': {
        args.model = argv[++index];
        break;
      }

      case '--object-key': {
        args.objectKey = argv[++index];
        break;
      }

      case '--project': {
        args.project = argv[++index];
        break;
      }

      case '--prompt': {
        args.prompt = argv[++index];
        break;
      }

      default: {
        throw new Error(`Unknown argument: ${current}`);
      }
    }

    if (current.startsWith('--') && !args.help) {
      const value = argv[index];
      if (!value) throw new Error(`Missing value for ${current}`);
    }
  }

  return args;
};

const printHelp = () => {
  console.info(`Vertex native PDF PoC

Usage:
  bunx tsx src/_custom/vertexPdfNativePoc.ts [options]

Options:
  --file <path>        Local PDF path to upload. Defaults to ${DEFAULT_FILE_PATH}
  --gcs-uri <uri>      Existing gs:// URI. Skips upload when provided
  --bucket <name>      GCS bucket name. Defaults to ${DEFAULT_BUCKET}
  --object-key <key>   Object key to reuse in the bucket
  --model <id>         Vertex model id. Defaults to ${DEFAULT_MODEL}
  --project <id>       Vertex project override
  --location <name>    Vertex location override
  --prompt <text>      Prompt to send with the PDF
  -h, --help           Show this help

Environment:
  VERTEXAI_CREDENTIALS
  VERTEXAI_PROJECT
  VERTEXAI_LOCATION
  VERTEX_PDF_POC_BUCKET
  VERTEX_PDF_POC_FILE
  VERTEX_PDF_POC_GCS_URI
  VERTEX_PDF_POC_MODEL
  VERTEX_PDF_POC_OBJECT_KEY
  VERTEX_PDF_POC_PROMPT
`);
};

const resolveVertexConfig = async (args: CliArgs): Promise<VertexPocConfig> => {
  const vertexOptions = await buildVertexGenAIOptionsFromEnv({
    location: args.location,
    project: args.project,
  });

  return {
    bucket: args.bucket || process.env.VERTEX_PDF_POC_BUCKET || DEFAULT_BUCKET,
    filePath: path.resolve(args.file || process.env.VERTEX_PDF_POC_FILE || DEFAULT_FILE_PATH),
    gcsUri: args.gcsUri || process.env.VERTEX_PDF_POC_GCS_URI,
    model: args.model || process.env.VERTEX_PDF_POC_MODEL || DEFAULT_MODEL,
    objectKey: args.objectKey || process.env.VERTEX_PDF_POC_OBJECT_KEY,
    prompt: args.prompt || process.env.VERTEX_PDF_POC_PROMPT || DEFAULT_PROMPT,
    vertexOptions,
  };
};

const ensureGcsObject = async (config: VertexPocConfig): Promise<string> => {
  if (config.gcsUri) return config.gcsUri;

  if (!existsSync(config.filePath)) {
    throw new Error(`PDF file not found: ${config.filePath}`);
  }

  const pdfBuffer = await readFile(config.filePath);
  const fileStats = await stat(config.filePath);
  const gcsUri = await ensureVertexPdfGcsUri({
    bucket: config.bucket,
    bytes: pdfBuffer,
    fileHash: undefined,
    fileName: config.filePath,
    objectKey:
      config.objectKey ||
      `vertex-pdf-poc/${fileStats.size}-${path.resolve(config.filePath).split('/').pop()}`,
    vertexOptions: config.vertexOptions,
  });

  console.info(`Uploaded PDF to GCS: ${gcsUri}`);
  return gcsUri;
};

const extractResponseText = (response: GenerateContentResponse): string => {
  if (response.text?.trim()) return response.text.trim();

  const fallbackText = response.candidates
    ?.flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  if (fallbackText) return fallbackText;

  return '';
};

const run = async () => {
  loadEnv();

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const config = await resolveVertexConfig(args);
  const gcsUri = await ensureGcsObject(config);
  const ai = new GoogleGenAI(config.vertexOptions);

  console.info(`Vertex project: ${config.vertexOptions.project}`);
  console.info(`Vertex location: ${config.vertexOptions.location}`);
  console.info(`Vertex model: ${config.model}`);
  console.info(`PDF source: ${gcsUri}`);
  console.info(`Prompt: ${config.prompt}`);

  const response = await ai.models.generateContent({
    config: {
      temperature: 0,
    },
    contents: [
      {
        parts: [
          { text: config.prompt },
          {
            fileData: {
              fileUri: gcsUri,
              mimeType: VERTEX_NATIVE_PDF_MIME_TYPE,
            },
          },
        ],
        role: 'user',
      },
    ],
    model: config.model,
  });

  const text = extractResponseText(response);

  console.info('\nModel response:\n');
  console.info(text || '(empty response)');

  if (response.usageMetadata) {
    console.info('\nUsage metadata:');
    console.info(JSON.stringify(response.usageMetadata, null, 2));
  }

  if (config.prompt === DEFAULT_PROMPT) {
    const verified = /\b123\b/.test(text);
    console.info(
      `\nVerification: ${verified ? 'PASS' : 'CHECK_MANUALLY'} (expected to mention 123)`,
    );
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
