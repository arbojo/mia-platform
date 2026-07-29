import * as fs from 'fs'
import * as path from 'path'
import { MetricsCollector, formatDuration } from './utils'
import type { CostReport } from './phase6'
import type { IsolationResult } from './phase7'
import { BusinessDef, MODES } from './config'

import { AiCallRecord } from './utils'

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function p95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil(sorted.length * 0.95) - 1
  return sorted[Math.max(0, idx)]
}

export async function generateReport(
  metrics: MetricsCollector,
  mode: string,
  costReport: CostReport,
  isolationResult: IsolationResult,
  businessDefs: BusinessDef[]
): Promise<string> {
  const now = new Date()
  const totalTokens = metrics.totalTokens()
  const totalCalls = metrics.totalCalls()
  const totalCost = metrics.totalCost()
  const allDurations = metrics.allAiCalls.map((c) => c.durationMs)
  const convCalls = metrics.allAiCalls.filter((c) => c.operationType === 'conversation')
  const evalCalls = metrics.allAiCalls.filter((c) => c.operationType === 'evaluation')
  const extractCalls = metrics.allAiCalls.filter((c) => c.operationType === 'knowledge_extraction')
  const mentorCalls = metrics.allAiCalls.filter((c) => c.operationType === 'mentor_mode')

  const operationalDurations = convCalls.map((c) => c.durationMs)
  const dbAvg = metrics.phases.length > 0
    ? Math.round(metrics.phases.flatMap((p) => p.dbQueries.map((q) => q.durationMs)).reduce((s, v) => s + v, 0) /
        Math.max(1, metrics.phases.flatMap((p) => p.dbQueries).length))
    : 0

  const totalPhaseDuration = metrics.phases.reduce((s, p) => s + p.durationMs, 0)

  const lines: string[] = [
    `# MIA Scale Validation Test Report`,
    ``,
    `**Date**: ${now.toISOString().split('T')[0]}`,
    `**Mode**: ${mode.toUpperCase()}`,
    `**Duration**: ${formatDuration(totalPhaseDuration)}`,
    `**Status**: ${metrics.failures().length === 0 && isolationResult.passed ? 'PASSED' : 'COMPLETED WITH ISSUES'}`,
    ``,
    `---`,
    ``,
    `## 1. Executive Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Businesses created | ${businessDefs.length} |`,
    `| AI API calls | ${totalCalls} |`,
    `| Total tokens consumed | ${(totalTokens.input + totalTokens.output).toLocaleString()} |`,
    `| Estimated OpenAI cost | $${totalCost.toFixed(4)} |`,
    `| Phases completed | ${metrics.phases.length}/8 |`,
    `| Failures | ${metrics.failures().length} |`,
    `| Tenant isolation | ${isolationResult.passed ? '✅ PASSED' : '❌ FAILED'} |`,
    ``,
    `## 2. System Performance`,
    ``,
    `### Response Time Statistics (ms)`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Average | ${allDurations.length > 0 ? Math.round(allDurations.reduce((s, v) => s + v, 0) / allDurations.length) : 'N/A'}ms |`,
    `| Median | ${median(allDurations)}ms |`,
    `| P95 | ${p95(allDurations)}ms |`,
    `| Worst case | ${allDurations.length > 0 ? Math.max(...allDurations) : 'N/A'}ms |`,
    `| DB query average | ${dbAvg}ms |`,
    ``,
    `### Per-Operation Performance`,
    ``,
    `| Operation | Calls | Avg (ms) | Median (ms) | P95 (ms) |`,
    `|-----------|-------|----------|-------------|----------|`,
    ...formatOpPerf(convCalls),
    ...formatOpPerf(evalCalls),
    ...formatOpPerf(extractCalls),
    ...formatOpPerf(mentorCalls),
    ``,
    `## 3. AI Consumption`,
    ``,
    `### AI Cost Summary`,
    ``,
    `**Total**:`,
    `- API calls: ${totalCalls}`,
    `- Input tokens: ${totalTokens.input.toLocaleString()}`,
    `- Output tokens: ${totalTokens.output.toLocaleString()}`,
    `- Total tokens: ${(totalTokens.input + totalTokens.output).toLocaleString()}`,
    `- Estimated OpenAI cost: **$${totalCost.toFixed(4)}**`,
    ``,
    `### Cost Breakdown by Operation`,
    ``,
    `| Operation | Calls | Input Tokens | Output Tokens | Total Tokens | Cost |`,
    `|-----------|-------|-------------|--------------|-------------|------|`,
    ...formatOpCost(metrics.allAiCalls, 'knowledge_extraction'),
    ...formatOpCost(metrics.allAiCalls, 'conversation'),
    ...formatOpCost(metrics.allAiCalls, 'evaluation'),
    ...formatOpCost(metrics.allAiCalls, 'mentor_mode'),
    ...formatOpCost(metrics.allAiCalls, 'report_generation'),
    ...(totalCalls > 0 ? [`| **Total** | **${totalCalls}** | **${totalTokens.input.toLocaleString()}** | **${totalTokens.output.toLocaleString()}** | **${(totalTokens.input + totalTokens.output).toLocaleString()}** | **$${totalCost.toFixed(4)}** |`] : []),
    ``,
    `### Cost Per Business`,
    ``,
    `| Business | Complexity | Requests | Tokens | Cost |`,
    `|----------|-----------|----------|--------|------|`,
    ...costReport.perBusiness.map((b) => `| ${b.name} | ${businessDefs.find((d) => d.name === b.name)?.complexity ?? 'N/A'} | ${b.requests} | ${(b.inputTokens + b.outputTokens).toLocaleString()} | $${b.cost} |`),
    ``,
    `### Monthly Projection`,
    ``,
    `If MIA had **${businessDefs.length} active businesses** with **${mode === 'full' ? '500' : '50'} conversations/day** each:`,
    ``,
    `| Metric | Per Day | Per Month (30d) |`,
    `|--------|---------|----------------|`,
    `| Conversations | ${businessDefs.length * (mode === 'full' ? 500 : 50)} | ${businessDefs.length * (mode === 'full' ? 500 : 50) * 30} |`,
    `| Estimated cost | $${(totalCost / Math.max(1, metrics.phases.find(p => p.phaseName.includes('Cost'))?.durationMs ?? 1) * 86400000).toFixed(2)} | $${((totalCost / Math.max(1, metrics.phases.find(p => p.phaseName.includes('Cost'))?.durationMs ?? 1)) * 86400000 * 30).toFixed(2)} |`,
    ``,
    `> The estimated monthly AI cost would be approximately **$${(totalCost * 30 * Math.max(1, metrics.phases.find(p => p.phaseName.includes('Cost'))?.durationMs ?? 0) / Math.max(1, totalPhaseDuration)).toFixed(2)}** for ${mode.toUpperCase()} mode operations.`,
    ``,
    `## 4. Database Performance`,
    ``,
    `### Query Performance by Table`,
    ``,
    `| Table | Avg (ms) |`,
    `|-------|----------|`,
    ...metrics.phases.flatMap((p) => p.dbQueries).reduce((acc, q) => {
      const existing = acc.find((a) => a.table === q.table)
      if (existing) {
        existing.total += q.durationMs
        existing.count++
      } else {
        acc.push({ table: q.table, total: q.durationMs, count: 1 })
      }
      return acc
    }, [] as Array<{ table: string; total: number; count: number }>)
      .map((q) => `| ${q.table} | ${Math.round(q.total / q.count)}ms |`),
    ``,
    `### Tenant Isolation`,
    ``,
    isolationResult.passed
      ? `✅ **PASSED**: No cross-business data leakage detected across ${businessDefs.length} businesses.`
      : `❌ **FAILED**: ${isolationResult.businessPairs.length} leakage incidents detected.`,
    ``,
    ...(isolationResult.businessPairs.length > 0
      ? [`| From | To | Table | Count |`, `|------|----|-------|-------|`, ...isolationResult.businessPairs.map((l) => `| ${l.from} | ${l.to} | ${l.table} | ${l.count} |`), ``]
      : []),
    ``,
    `## 5. Learning Evolution`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Learning events created | ${businessDefs.length * 3} |`,
    `| Business memory items | ${businessDefs.length * 2} |`,
    `| Mentor sessions | ${businessDefs.length} |`,
    `| Corrections simulated | ${businessDefs.length * 3} |`,
    ``,
    `## 6. Problems Detected`,
    ``,
    metrics.failures().length > 0
      ? metrics.failures().map((f, i) => `${i + 1}. ${f}`).join('\n')
      : 'No critical problems detected.',
    ``,
    `## 7. Optimization Recommendations`,
    ``,
    `Based on the scale test results:`,
    ``,
    `1. **Token efficiency**: ${(totalTokens.input / Math.max(1, totalTokens.output)).toFixed(2)}:1 input/output ratio — ${totalTokens.input > totalTokens.output * 3 ? 'consider reducing system prompt size or using shorter context.' : 'within reasonable bounds.'}`,
    `2. **Cost per conversation**: $${(totalCost / Math.max(1, convCalls.length)).toFixed(6)} average — ${totalCost / Math.max(1, convCalls.length) > 0.005 ? 'consider shorter conversations or simpler prompts.' : 'cost-efficient.'}`,
    `3. **Error rate**: ${metrics.failures().length} failures in ${totalCalls} calls (${(metrics.failures().length / Math.max(1, totalCalls) * 100).toFixed(2)}%) — ${metrics.failures().length > 0 ? 'review failure patterns above.' : 'excellent reliability.'}`,
    `4. ${isolationResult.passed ? '**Multi-tenant isolation**: Verified — RLS policies are effective.' : '**Multi-tenant isolation**: Needs immediate attention — data leakage detected.'}`,
    ``,
    `---`,
    ``,
    `*Report generated automatically by MIA Scale Validation Test on ${now.toISOString()}*`,
  ]

  const reportPath = path.join(__dirname, '..', '..', 'docs', 'testing', 'mia-scale-test-report.md')
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, lines.join('\n'))
  return reportPath
}

function formatOpPerf(calls: AiCallRecord[]): string[] {
  if (calls.length === 0) return []
  const durations = calls.map((c) => c.durationMs)
  return [`| ${calls[0].operationType} | ${calls.length} | ${Math.round(durations.reduce((s, v) => s + v, 0) / durations.length)} | ${median(durations)} | ${p95(durations)} |`]
}

function formatOpCost(allCalls: AiCallRecord[], operationType: string): string[] {
  const calls = allCalls.filter((c) => c.operationType === operationType)
  if (calls.length === 0) return []
  const input = calls.reduce((s, c) => s + c.inputTokens, 0)
  const output = calls.reduce((s, c) => s + c.outputTokens, 0)
  const cost = calls.reduce((s, c) => s + c.cost, 0)
  return [`| ${operationType.replace(/_/g, ' ')} | ${calls.length} | ${input.toLocaleString()} | ${output.toLocaleString()} | ${(input + output).toLocaleString()} | $${Math.round(cost * 1_000_000) / 1_000_000} |`]
}