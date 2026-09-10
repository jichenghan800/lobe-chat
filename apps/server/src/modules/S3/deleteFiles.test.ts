// @vitest-environment node
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { S3 } from './index';

vi.mock('@/envs/file', () => ({ fileEnv: {} }));

describe('OSS batch deletion wire compatibility', () => {
  it('signs the checksum of the actual UTF-8 XML sent by the SDK', async () => {
    let body = '';
    let checksum: string | string[] | undefined;
    let authorization: string | undefined;
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      body = Buffer.concat(chunks).toString('utf8');
      checksum = request.headers['content-md5'];
      authorization = request.headers.authorization;
      response.setHeader('Content-Type', 'application/xml');
      response.end('<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No test server address');
      const s3 = new S3('test-key', 'test-secret', `http://127.0.0.1:${address.port}`, {
        bucket: 'synthetic-bucket',
        forcePathStyle: true,
      });
      await s3.deleteFiles(['合成文件/a&b<1>.txt', 'second.txt']);
      expect(body).toContain('合成文件/a&amp;b&lt;1&gt;.txt');
      expect(checksum).toBe(createHash('md5').update(body).digest('base64'));
      expect(authorization).toMatch(/SignedHeaders=[^,]*content-md5/);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
