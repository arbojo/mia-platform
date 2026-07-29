import assert from 'node:assert/strict';
import type { WorkshopEvent } from '../../types';
import { RuleRegistry } from '../engine/rule-registry';
import { RuleEngine } from '../engine/rule-engine';
import { DeadInteractionRule } from '../rules/dead-interaction-rule';
import { RuntimeErrorRule } from '../rules/runtime-error-rule';

const events: WorkshopEvent[] = [
  { id: '1', timestamp: '2026-01-01T00:00:00.000Z', sessionId: 's1', source: 'Browser', category: 'UI', severity: 'warning', action: 'click', module: 'dashboard', metadata: {} },
  { id: '2', timestamp: '2026-01-01T00:00:01.000Z', sessionId: 's1', source: 'Runtime', category: 'Runtime', severity: 'error', action: 'runtime failure', module: 'dashboard', metadata: {} },
  { id: '3', timestamp: '2026-01-01T00:00:02.000Z', sessionId: 's1', source: 'Runtime', category: 'Runtime', severity: 'error', action: 'console error', module: 'dashboard', metadata: {} },
];

const registry = new RuleRegistry();
registry.registerRule(new DeadInteractionRule());
registry.registerRule(new RuntimeErrorRule());

const engine = new RuleEngine(registry);
const result = engine.run(events, 's1');

assert.equal(result.ruleCount, 2);
assert.ok(result.findings.length >= 1);
assert.ok(result.findings[0].severity);
assert.ok(result.findings[0].confidence >= 0.4);

console.log('Intelligence flow OK');
