import type { WorkshopEventInput } from '../../types';

export interface ApiObserverOptions {
  sessionId: string;
  emit: (event: WorkshopEventInput) => void;
}

export class ApiObserver {
  private readonly sessionId: string;
  private readonly emit: (event: WorkshopEventInput) => void;
  private attached = false;

  constructor(options: ApiObserverOptions) {
    this.sessionId = options.sessionId;
    this.emit = options.emit;
  }

  public attach(): void {
    if (this.attached || typeof window === 'undefined') {
      return;
    }

    this.attached = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = this.toUrl(input);
      const method = init?.method ?? 'GET';
      this.emit({
        sessionId: this.sessionId,
        source: 'Backend',
        category: 'API',
        severity: 'info',
        action: 'request started',
        module: 'api',
        metadata: { method, url },
      });

      const startedAt = Date.now();
      return originalFetch(input, init).then((response) => {
        this.emit({
          sessionId: this.sessionId,
          source: 'Backend',
          category: 'API',
          severity: response.ok ? 'info' : 'error',
          action: response.ok ? 'response finished' : 'http error',
          module: 'api',
          duration: Date.now() - startedAt,
          metadata: { method, url, status: response.status },
        });
        return response;
      }).catch((error) => {
        this.emit({
          sessionId: this.sessionId,
          source: 'Backend',
          category: 'API',
          severity: 'error',
          action: 'request failed',
          module: 'api',
          duration: Date.now() - startedAt,
          metadata: { method, url, message: error instanceof Error ? error.message : String(error) },
        });
        throw error;
      });
    };
  }

  public destroy(): void {
    this.attached = false;
  }

  private toUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof URL) {
      return input.toString();
    }

    return input.url;
  }
}
