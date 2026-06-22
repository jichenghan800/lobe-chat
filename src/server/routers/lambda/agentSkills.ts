import type { SkillManifest } from '@lobechat/types';
import { skillManifestSchema } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import debug from 'debug';
import { z } from 'zod';

import { AgentSkillModel } from '@/database/models/agentSkill';
import { FileModel } from '@/database/models/file';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { FileService } from '@/server/services/file';
import { MarketService } from '@/server/services/market';
import {
  SkillImporter,
  SkillImportError,
  SkillResourceError,
  SkillResourceService,
} from '@/server/services/skill';

const log = debug('lobe-server:agent-skills-router');

// ===== Error Handling =====

const skillImportErrorToTRPCCode = (
  code: SkillImportError['code'],
): 'CONFLICT' | 'BAD_REQUEST' | 'NOT_FOUND' | 'BAD_GATEWAY' => {
  switch (code) {
    case 'CONFLICT': {
      return 'CONFLICT';
    }

    case 'NOT_FOUND':
    case 'FILE_NOT_FOUND': {
      return 'NOT_FOUND';
    }

    case 'DOWNLOAD_FAILED': {
      return 'BAD_GATEWAY';
    }

    default: {
      return 'BAD_REQUEST';
    }
  }
};

const handleSkillImportError = (error: unknown): never => {
  if (error instanceof SkillImportError) {
    throw new TRPCError({
      code: skillImportErrorToTRPCCode(error.code),
      message: error.message,
    });
  }
  throw error;
};

// ===== Procedure with Context =====

const skillProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const skillModel = new AgentSkillModel(ctx.serverDB, ctx.userId);

  return opts.next({
    ctx: {
      fileModel: new FileModel(ctx.serverDB, ctx.userId),
      fileService: new FileService(ctx.serverDB, ctx.userId),
      marketService: new MarketService({ userInfo: { userId: ctx.userId } }),
      skillImporter: new SkillImporter(ctx.serverDB, ctx.userId),
      skillModel,
    },
  });
});

const skillResourceProcedure = skillProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      skillResourceService: new SkillResourceService(ctx.serverDB, ctx.userId),
    },
  });
});

// ===== Input Schemas =====

const createSkillSchema = z.object({
  content: z.string(),
  description: z.string().min(1),
  identifier: z.string().optional(),
  name: z.string().min(1),
});

const updateSkillSchema = z.object({
  content: z.string().optional(),
  id: z.string(),
  // All metadata should be passed through manifest
  manifest: skillManifestSchema.partial().optional(),
});

// ===== Router =====

export const agentSkillsRouter = router({
  // ===== Create =====

  create: skillProcedure.input(createSkillSchema).mutation(async ({ ctx, input }) => {
    const startTime = Date.now();
    log('create:start name=%s hasIdentifier=%s', input.name, !!input.identifier);
    try {
      const result = await ctx.skillImporter.createUserSkill(input);
      log(
        'create:success id=%s name=%s durationMs=%d',
        result.id,
        result.name,
        Date.now() - startTime,
      );
      return result;
    } catch (error) {
      log(
        'create:failed name=%s durationMs=%d error=%O',
        input.name,
        Date.now() - startTime,
        error,
      );
      handleSkillImportError(error);
    }
  }),

  // ===== Delete =====

  delete: skillProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.skillModel.delete(input.id);
  }),

  // ===== Query =====

  getById: skillProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const startTime = Date.now();
    const skill = await ctx.skillModel.findById(input.id);
    log(
      'getById:done id=%s found=%s name=%s source=%s durationMs=%d',
      input.id,
      !!skill,
      skill?.name,
      skill?.source,
      Date.now() - startTime,
    );
    return skill;
  }),

  getByIdWithZipUrl: skillProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const startTime = Date.now();
      const skill = await ctx.skillModel.findById(input.id);
      if (!skill) {
        log('getByIdWithZipUrl:notFound id=%s durationMs=%d', input.id, Date.now() - startTime);
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found' });
      }

      if (!skill.zipFileHash) {
        log(
          'getByIdWithZipUrl:noZip id=%s name=%s durationMs=%d',
          input.id,
          skill.name,
          Date.now() - startTime,
        );
        return { name: skill.name, url: null };
      }

      const fileInfo = await ctx.fileModel.checkHash(skill.zipFileHash);
      if (!fileInfo.isExist || !fileInfo.url) {
        log(
          'getByIdWithZipUrl:fileMissing id=%s name=%s zipHash=%s durationMs=%d',
          input.id,
          skill.name,
          skill.zipFileHash,
          Date.now() - startTime,
        );
        return { name: skill.name, url: null };
      }

      const fullUrl = await ctx.fileService.getFullFileUrl(fileInfo.url);
      log(
        'getByIdWithZipUrl:success id=%s name=%s hasUrl=%s durationMs=%d',
        input.id,
        skill.name,
        !!fullUrl,
        Date.now() - startTime,
      );
      return { name: skill.name, url: fullUrl || null };
    }),

  getByIdentifier: skillProcedure
    .input(z.object({ identifier: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.skillModel.findByIdentifier(input.identifier);
    }),

  getByName: skillProcedure.input(z.object({ name: z.string() })).query(async ({ ctx, input }) => {
    return ctx.skillModel.findByName(input.name);
  }),

  importFromGitHub: skillProcedure
    .input(
      z.object({
        branch: z.string().optional(),
        gitUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.skillImporter.importFromGitHub(input);
      } catch (error) {
        handleSkillImportError(error);
      }
    }),

  importFromUrl: skillProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.skillImporter.importFromUrl(input);
      } catch (error) {
        handleSkillImportError(error);
      }
    }),

  importFromZip: skillProcedure
    .input(z.object({ zipFileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      log('importFromZip:start zipFileId=%s', input.zipFileId);
      try {
        const result = await ctx.skillImporter.importFromZip(input);
        log(
          'importFromZip:success zipFileId=%s skillId=%s skillName=%s status=%s durationMs=%d',
          input.zipFileId,
          result.skill.id,
          result.skill.name,
          result.status,
          Date.now() - startTime,
        );
        return result;
      } catch (error) {
        log(
          'importFromZip:failed zipFileId=%s durationMs=%d error=%O',
          input.zipFileId,
          Date.now() - startTime,
          error,
        );
        handleSkillImportError(error);
      }
    }),

  importFromMarket: skillProcedure
    .input(z.object({ identifier: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get download URL from market service
        const downloadUrl = ctx.marketService.getSkillDownloadUrl(input.identifier);
        // Import using the download URL
        return await ctx.skillImporter.importFromUrl(
          { url: downloadUrl },
          { identifier: input.identifier, source: 'market' },
        );
      } catch (error) {
        handleSkillImportError(error);
      }
    }),

  list: skillProcedure
    .input(
      z
        .object({
          source: z.enum(['builtin', 'market', 'user']).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const startTime = Date.now();
      if (input?.source) {
        const result = await ctx.skillModel.listBySource(input.source);
        log(
          'list:done source=%s total=%d durationMs=%d',
          input.source,
          result.total,
          Date.now() - startTime,
        );
        return result;
      }

      const result = await ctx.skillModel.findAll();
      log('list:done source=all total=%d durationMs=%d', result.total, Date.now() - startTime);
      return result;
    }),

  listResources: skillResourceProcedure
    .input(z.object({ id: z.string(), includeContent: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const startTime = Date.now();
      const skill = await ctx.skillModel.findById(input.id);
      if (!skill) {
        log('listResources:notFound id=%s durationMs=%d', input.id, Date.now() - startTime);
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found' });
      }

      if (!skill.resources) {
        log(
          'listResources:noResources id=%s name=%s durationMs=%d',
          input.id,
          skill.name,
          Date.now() - startTime,
        );
        return [];
      }

      const resources = await ctx.skillResourceService.listResources(
        skill.resources,
        input.includeContent,
      );
      log(
        'listResources:success id=%s name=%s resourceCount=%d rootCount=%d includeContent=%s durationMs=%d',
        input.id,
        skill.name,
        Object.keys(skill.resources).length,
        resources.length,
        !!input.includeContent,
        Date.now() - startTime,
      );
      return resources;
    }),

  readResource: skillResourceProcedure
    .input(
      z.object({
        id: z.string(),
        path: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const startTime = Date.now();
      const skill = await ctx.skillModel.findById(input.id);
      if (!skill) {
        log(
          'readResource:notFound id=%s path=%s durationMs=%d',
          input.id,
          input.path,
          Date.now() - startTime,
        );
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found' });
      }

      if (!skill.resources || Object.keys(skill.resources).length === 0) {
        log(
          'readResource:noResources id=%s name=%s path=%s durationMs=%d',
          input.id,
          skill.name,
          input.path,
          Date.now() - startTime,
        );
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Skill has no resources' });
      }

      try {
        const resource = await ctx.skillResourceService.readResource(skill.resources, input.path);
        log(
          'readResource:success id=%s name=%s path=%s size=%d encoding=%s durationMs=%d',
          input.id,
          skill.name,
          input.path,
          resource.size,
          resource.encoding,
          Date.now() - startTime,
        );
        return resource;
      } catch (error) {
        log(
          'readResource:failed id=%s name=%s path=%s durationMs=%d error=%O',
          input.id,
          skill.name,
          input.path,
          Date.now() - startTime,
          error,
        );
        if (error instanceof SkillResourceError) {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }

        throw error;
      }
    }),

  search: skillProcedure.input(z.object({ query: z.string() })).query(async ({ ctx, input }) => {
    return ctx.skillModel.search(input.query);
  }),

  // ===== Update =====

  update: skillProcedure.input(updateSkillSchema).mutation(async ({ ctx, input }) => {
    const { id, content, manifest } = input;
    return ctx.skillModel.update(id, {
      content,
      // Sync name/description from manifest to top-level fields
      description: manifest?.description,
      manifest: manifest as SkillManifest | undefined,
      name: manifest?.name,
    });
  }),
});

export type AgentSkillsRouter = typeof agentSkillsRouter;
