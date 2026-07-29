import type { CouncilContext, CouncilRole } from '../types';
import { FindingBuilder } from '../findings/finding-builder';

export class PerformanceRole implements CouncilRole {
  public readonly id = 'performance';
  public readonly name = 'Performance';
  public readonly responsibility = 'Reviews performance implications from available evidence.';

  public audit(context: CouncilContext) {
    const findings = [];

    if (context.evidenceSnapshot.performanceSummary.apiDurationsMs.some((duration) => duration > 200)) {
      findings.push(FindingBuilder.create({
        role: this.name,
        severity: 'medium',
        category: 'performance',
        title: 'Se detectaron duraciones elevadas en APIs',
        description: 'La evidencia incluye tiempos de respuesta altos.',
        evidence: context.evidenceSnapshot.performanceSummary.apiDurationsMs.map((duration) => `Duración API: ${duration}ms`),
        affectedArea: 'performance',
        recommendation: 'Evaluar posibles cuellos de botella y optimizar el flujo crítico.',
      }));
    }

    return findings;
  }
}
