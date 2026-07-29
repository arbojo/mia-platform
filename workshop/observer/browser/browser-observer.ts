import type { WorkshopEventInput } from '../../types';

export interface BrowserObserverOptions {
  sessionId: string;
  emit: (event: WorkshopEventInput) => void;
  page?: string;
}

export class BrowserObserver {
  private readonly sessionId: string;
  private readonly emit: (event: WorkshopEventInput) => void;
  private readonly page: string;
  private mounted = false;

  constructor(options: BrowserObserverOptions) {
    this.sessionId = options.sessionId;
    this.emit = options.emit;
    this.page = options.page ?? (typeof window !== 'undefined' ? window.location.pathname : 'unknown');
  }

  public attach(): void {
    if (this.mounted || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.mounted = true;
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('dblclick', this.handleDoubleClick, true);
    document.addEventListener('contextmenu', this.handleContextMenu, true);
    document.addEventListener('scroll', this.handleScroll, true);
    document.addEventListener('focusin', this.handleFocus, true);
    document.addEventListener('focusout', this.handleBlur, true);
    document.addEventListener('keydown', this.handleKeyDown, true);

    window.addEventListener('popstate', this.handleRouteChange);
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.pushState = ((...args: Parameters<typeof window.history.pushState>) => {
      const result = originalPushState(...args);
      this.handleRouteChange();
      return result;
    }) as typeof window.history.pushState;

    window.history.replaceState = ((...args: Parameters<typeof window.history.replaceState>) => {
      const result = originalReplaceState(...args);
      this.handleRouteChange();
      return result;
    }) as typeof window.history.replaceState;
  }

  public destroy(): void {
    if (!this.mounted || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('dblclick', this.handleDoubleClick, true);
    document.removeEventListener('contextmenu', this.handleContextMenu, true);
    document.removeEventListener('scroll', this.handleScroll, true);
    document.removeEventListener('focusin', this.handleFocus, true);
    document.removeEventListener('focusout', this.handleBlur, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('popstate', this.handleRouteChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.mounted = false;
  }

  private handleClick = (event: Event): void => {
    this.emitBrowserEvent('click', event);
  };

  private handleDoubleClick = (event: Event): void => {
    this.emitBrowserEvent('double click', event);
  };

  private handleContextMenu = (event: Event): void => {
    this.emitBrowserEvent('context menu', event);
  };

  private handleScroll = (event: Event): void => {
    this.emitBrowserEvent('scroll', event);
  };

  private handleFocus = (event: Event): void => {
    this.emitBrowserEvent('focus', event);
  };

  private handleBlur = (event: Event): void => {
    this.emitBrowserEvent('blur', event);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!event.key) {
      return;
    }

    const hotkey = ['Ctrl', 'Alt', 'Shift', 'Meta'].some((modifier) => event.getModifierState(modifier));
    this.emitBrowserEvent(hotkey ? `shortcut:${event.key}` : `key:${event.key}`, event, {
      key: event.key,
      code: event.code,
      hotkey,
    });
  };

  private handleRouteChange = (): void => {
    this.emit({
      sessionId: this.sessionId,
      source: 'Browser',
      category: 'Navigation',
      severity: 'info',
      action: 'route change',
      module: 'browser',
      page: this.currentRoute(),
      metadata: {
        previousPage: this.page,
        route: this.currentRoute(),
      },
    });
  };

  private handleBeforeUnload = (): void => {
    this.emit({
      sessionId: this.sessionId,
      source: 'Browser',
      category: 'Navigation',
      severity: 'info',
      action: 'navigation complete',
      module: 'browser',
      page: this.currentRoute(),
      metadata: {
        reason: 'beforeunload',
      },
    });
  };

  private emitBrowserEvent(action: string, event: Event, metadata: Record<string, unknown> = {}): void {
    const target = event.target instanceof Element ? event.target : null;
    const component = target?.closest('[data-component]')?.getAttribute('data-component') ?? target?.getAttribute('data-testid') ?? undefined;

    this.emit({
      sessionId: this.sessionId,
      source: 'Browser',
      category: 'UI',
      severity: 'info',
      action,
      module: 'browser',
      page: this.currentRoute(),
      component,
      metadata: {
        tag: target?.tagName?.toLowerCase(),
        id: target?.id ? target.id : undefined,
        selector: target ? this.getSelector(target) : undefined,
        text: target ? target.textContent?.slice(0, 120) : undefined,
        ...metadata,
      },
    });
  }

  private currentRoute(): string {
    if (typeof window === 'undefined') {
      return this.page;
    }
    return `${window.location.pathname}${window.location.search}`;
  }

  private getSelector(target: Element): string {
    if (target.id) {
      return `#${target.id}`;
    }

    const className = target.className && typeof target.className === 'string' ? `.${target.className.split(/\s+/).filter(Boolean).join('.')}` : '';
    return `${target.tagName.toLowerCase()}${className}`;
  }
}
