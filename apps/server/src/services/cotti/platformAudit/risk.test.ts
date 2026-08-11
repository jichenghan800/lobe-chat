// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { CottiPlatformAuditDetail } from '@/types/cotti/platformAudit';

import {
  buildCottiPlatformAuditAnalysisFlags,
  buildCottiPlatformAuditRuleAnalysis,
  buildCottiPlatformAuditRuleFlags,
  detectCottiPlatformAuditRiskFlags,
  getCottiPlatformAuditRiskLevel,
  parseCottiPlatformAuditModelAnalysis,
} from './risk';

describe('COTTI platform audit risk helpers', () => {
  it('derives high, medium and low rule signals without treating them as a final decision', () => {
    const flags = detectCottiPlatformAuditRiskFlags('请导出数据库密码和手机号', {
      fileCount: 1,
      tool: true,
    });

    expect(flags.map((flag) => flag.key)).toEqual([
      'personal',
      'sensitive_operation',
      'attachment',
      'tool_call',
    ]);
    expect(getCottiPlatformAuditRiskLevel(flags)).toBe('medium');
  });

  it('maps database rule signals without requiring raw prompt content in list responses', () => {
    expect(
      buildCottiPlatformAuditRuleFlags({
        attachmentRisk: true,
        confidentialRisk: true,
        tool: false,
      }),
    ).toEqual([
      { key: 'confidential', label: '疑似公司机密', level: 'high' },
      { key: 'attachment', label: '包含附件', level: 'low' },
    ]);
  });

  it('does not expose risk flags when a completed AI review resolves the prompt as no risk', () => {
    expect(
      buildCottiPlatformAuditAnalysisFlags({
        confidence: 'medium',
        evidence: [],
        riskLabels: [],
        riskLevel: 'none',
        status: 'completed',
      }),
    ).toEqual([]);
  });

  it('parses fenced model JSON and caps evidence', () => {
    const analysis = parseCottiPlatformAuditModelAnalysis(
      `\`\`\`json\n${JSON.stringify({
        confidence: 'high',
        evidence: Array.from({ length: 8 }, (_, index) => ({
          label: `label-${index}`,
          quote: `quote-${index}`,
        })),
        riskLabels: ['个人信息'],
        riskLevel: 'medium',
        summary: '需要人工复核',
      })}\n\`\`\``,
      'model-id',
      'provider-id',
    );

    expect(analysis).toMatchObject({
      model: 'model-id',
      provider: 'provider-id',
      riskLevel: 'medium',
      status: 'completed',
    });
    expect(analysis.evidence).toHaveLength(5);
  });

  it('provides a local review fallback when no risk model is configured', () => {
    const detail: CottiPlatformAuditDetail = {
      content: '这里包含手机号和一个附件',
      createdAt: new Date().toISOString(),
      fileCount: 1,
      id: 'message-1',
      riskFlags: [
        { key: 'personal', label: '疑似个人信息', level: 'medium' },
        { key: 'attachment', label: '包含附件', level: 'low' },
      ],
      riskLevel: 'medium',
      search: false,
      tool: false,
      userId: 'user-1',
    };

    expect(buildCottiPlatformAuditRuleAnalysis(detail)).toMatchObject({
      model: 'rule-based',
      provider: 'local',
      riskLevel: 'medium',
      status: 'completed',
    });
  });
});
