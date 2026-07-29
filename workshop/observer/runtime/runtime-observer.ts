import type { WorkshopEventInput } from '../../types';

export interface RuntimeObserverOptions {
  sessionId: string;
  emit: (event: WorkshopEventInput) => void;
}

export class RuntimeObserver {
  private readonly sessionId: string;
  private readonly emit: (event: WorkshopEventInput) => void;
  private attached = false;

  constructor(options: RuntimeObserverOptions) {
    this.sessionId = options.sessionId;
    this.emit = options.emit;
  }

  public attach(): void {
    if (this.attached || typeof window === 'undefined') {
      return;
    }

    this.attached = true;
    window.addEventListener('error', this.handleGlobalError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);

    const originalConsoleError = console.error.bind(console);
    const originalConsoleWarn = console.warn.bind(console);

    console.error = (...args: unknown[]) => {
      this.emit({
        sessionId: this.sessionId,
        source: 'Runtime',
        category: 'Errors',
        severity: 'error',
        action: 'console error',
        module: 'runtime',
        metadata: { message: this.stringify(args) },
      });
      originalConsoleError(...args);
    };

    console.warn = (...args: unknown[]) => {
      this.emit({
        sessionId: this.sessionId,
        source: 'Runtime',
        category: 'Warnings',
        severity: 'warning',
        action: 'console warning',
        module: 'runtime',
        metadata: { message: this.stringify(args) },
      });
      originalConsoleWarn(...args);
    };
  }

  public destroy(): void {
    if (!this.attached || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    this.attached = false;
  }

  private handleGlobalError = (event: ErrorEvent): void => {
    this.emit({
      sessionId: this.sessionId,
      source: 'Runtime',
      category: 'Errors',
      severity: 'error',
      action: 'runtime error',
      module: 'runtime',
      metadata: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    this.emit({
      sessionId: this.sessionId,
      source: 'Runtime',
      category: 'Errors',
      severity: 'error',
      action: 'unhandled promise',
      module: 'runtime',
      metadata: {
        reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
      },
    });
  };

  private stringify(args: unknown[]): string {
    return args.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' ');
  }
}
