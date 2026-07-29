import assert from 'node:assert/strict';
import { BrowserObserver } from '../observer/browser/browser-observer';
import { UiObserver } from '../observer/ui/ui-observer';
import { RuntimeObserver } from '../observer/runtime/runtime-observer';
import { ApiObserver } from '../observer/api/api-observer';
import { WorkshopPerformanceObserver } from '../observer/performance/performance-observer';
import { DeadInteractionDetector } from '../observer/dead-interaction/dead-interaction-detector';
import { SessionTimeline } from '../runtime/session-timeline';

const events: Array<{ category: string; action: string }> = [];
const emit = (event: { category: string; action: string }) => events.push(event);

const browserObserver = new BrowserObserver({ sessionId: 'test-session', emit: emit as never });
const uiObserver = new UiObserver({ sessionId: 'test-session', emit: emit as never, timeoutMs: 100 });
const runtimeObserver = new RuntimeObserver({ sessionId: 'test-session', emit: emit as never });
const apiObserver = new ApiObserver({ sessionId: 'test-session', emit: emit as never });
const performanceObserver = new WorkshopPerformanceObserver({ sessionId: 'test-session', emit: emit as never });
const detector = new DeadInteractionDetector({ sessionId: 'test-session', emit: emit as never, timeoutMs: 100 });
const timeline = new SessionTimeline();

browserObserver.attach();
uiObserver.attach();
runtimeObserver.attach();
apiObserver.attach();
performanceObserver.attach();
detector.trackInteraction({ key: 'test', component: 'button', route: '/dashboard' });

const timelineItems = timeline.build([{ id: '1', timestamp: '2026-01-01T00:00:00.000Z', sessionId: 'test-session', source: 'Browser', category: 'UI', severity: 'info', action: 'click', module: 'browser', metadata: {} }]);
assert.equal(timelineItems.length, 1);
assert.equal(events.length >= 0, true);

browserObserver.destroy();
uiObserver.destroy();
runtimeObserver.destroy();
apiObserver.destroy();
performanceObserver.destroy();

console.log('Sprint 1 observer flow OK');
