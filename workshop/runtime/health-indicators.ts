import type { WorkshopEvent } from '../types';

export interface SessionHealth {
  buildStability: number;
  runtimeStability: number;
  navigationHealth: number;
  interactionHealth: number;
  apiHealth: number;
  performanceHealth: number;
}

export class SessionHealthCalculator {
  public calculate(events: WorkshopEvent[]): SessionHealth {
    const errors = events.filter((event) => event.severity === 'error' || event.severity === 'critical').length;
    const warnings = events.filter((event) => event.severity === 'warning').length;
    const deadInteractions = events.filter((event) => event.action === 'dead interaction' || event.action === 'repeated dead interaction').length;
    const apiErrors = events.filter((event) => event.category === 'API' && (event.severity === 'error' || event.severity === 'critical')).length;
    const navigationEvents = events.filter((event) => event.category === 'Navigation').length;

    return {
      buildStability: Math.max(0, 100 - errors * 5 - warnings),
      runtimeStability: Math.max(0, 100 - errors * 10),
      navigationHealth: Math.max(0, 100 - navigationEvents * 2 - deadInteractions * 10),
      interactionHealth: Math.max(0, 100 - deadInteractions * 15),
      apiHealth: Math.max(0, 100 - apiErrors * 15),
      performanceHealth: Math.max(0, 100 - warnings * 4),
    };
  }
}
