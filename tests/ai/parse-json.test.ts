import { describe, it, expect } from 'vitest'
import { parseAiJson } from '@/lib/ai/parse-json'

/**
 * The exact shape that broke the nightly learning pipeline in production:
 * `Unexpected token '`', "```json\n{"... is not valid JSON`.
 */
const FENCED = '```json\n{"patterns":[{"category":"pricing_question"}]}\n```'

describe('parseAiJson', () => {
  it('parses bare JSON', () => {
    expect(parseAiJson<{ a: number }>('{"a":1}', 'test')).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in a json fence', () => {
    expect(parseAiJson<{ patterns: unknown[] }>(FENCED, 'test')).toEqual({
      patterns: [{ category: 'pricing_question' }],
    })
  })

  it('parses JSON in a fence with no language tag', () => {
    expect(parseAiJson<{ a: number }>('```\n{"a":1}\n```', 'test')).toEqual({ a: 1 })
  })

  it('parses JSON in a fence tagged with uppercase JSON', () => {
    expect(parseAiJson<{ a: number }>('```JSON\n{"a":1}\n```', 'test')).toEqual({ a: 1 })
  })

  it('parses a single-line fence', () => {
    expect(parseAiJson<{ a: number }>('```json\n{"a":1}```', 'test')).toEqual({ a: 1 })
  })

  it('parses a top-level array', () => {
    expect(parseAiJson<number[]>('[1,2,3]', 'test')).toEqual([1, 2, 3])
  })

  it('parses fenced JSON followed by a closing remark', () => {
    const content = '```json\n{"a":1}\n```\n\nThat is the analysis you asked for.'
    expect(parseAiJson<{ a: number }>(content, 'test')).toEqual({ a: 1 })
  })

  it('parses JSON preceded by prose', () => {
    const content = 'Here is the analysis:\n{"a":1}\nHope it helps.'
    expect(parseAiJson<{ a: number }>(content, 'test')).toEqual({ a: 1 })
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseAiJson<{ a: number }>('\n\n  {"a":1}  \n\n', 'test')).toEqual({ a: 1 })
  })

  it('keeps braces that belong to the payload', () => {
    const content = '```json\n{"content":"use { and } freely","count":2}\n```'
    expect(parseAiJson<{ content: string; count: number }>(content, 'test')).toEqual({
      content: 'use { and } freely',
      count: 2,
    })
  })

  it('throws a message naming the context, not a bare SyntaxError', () => {
    expect(() => parseAiJson('not json at all', 'weekly report')).toThrow(
      /Failed to parse weekly report JSON/
    )
  })

  it('includes a snippet of the offending payload in the error', () => {
    expect(() => parseAiJson('totally not json', 'test')).toThrow(/totally not json/)
  })
})
