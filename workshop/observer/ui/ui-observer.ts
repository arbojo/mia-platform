import type { WorkshopEventInput } from '../../types';
import { DeadInteractionDetector } from '../dead-interaction/dead-interaction-detector';

export interface UiObserverOptions {
  sessionId: string;
  emit: (event: WorkshopEventInput) => void;
  timeoutMs?: number;
}

export class UiObserver {
  private readonly sessionId: string;
  private readonly emit: (event: WorkshopEventInput) => void;
  private readonly detector: DeadInteractionDetector;
  private attached = false;

  constructor(options: UiObserverOptions) {
    this.sessionId = options.sessionId;
    this.emit = options.emit;
    this.detector = new DeadInteractionDetector({
      sessionId: this.sessionId,
      emit: this.emit,
      timeoutMs: options.timeoutMs,
      module: 'ui',
    });
  }

  public attach(): void {
    if (this.attached || typeof document === 'undefined') {
      return;
    }

    this.attached = true;
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  public destroy(): void {
    if (!this.attached || typeof document === 'undefined') {
      return;
    }

    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    this.attached = false;
  }

  private handleClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    const component = target?.closest('[data-component]')?.getAttribute('data-component') ?? target?.getAttribute('data-testid') ?? undefined;
    const key = `${target?.tagName ?? 'unknown'}:${component ?? target?.id ?? 'anonymous'}`;

    if (target?.hasAttribute('disabled') || target?.getAttribute('aria-disabled') === 'true') {
      this.emit({
        sessionId: this.sessionId,
        source: 'Frontend',
        category: 'UI',
        severity: 'warning',
        action: 'disabled interaction',
        module: 'ui',
        component,
        metadata: { key, selector: this.getSelector(target) },
      });
      return;
    }

    this.detector.trackInteraction({
      key,
      component,
      route: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : undefined,
      action: 'click',
      metadata: { selector: target ? this.getSelector(target) : undefined },
    });
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      this.detector.resolve(`${event.target instanceof Element ? event.target.tagName : 'unknown'}:${event.target instanceof Element ? event.target.id : 'none'}`);
    }
  };

  private getSelector(target: Element): string {
    if (target.id) {
      return `#${target.id}`;
    }

    const className = target.className && typeof target.className === 'string' ? `.${target.className.split(/\s+/).filter(Boolean).join('.')}` : '';
    return `${target.tagName.toLowerCase()}${className}`;
  }
}
