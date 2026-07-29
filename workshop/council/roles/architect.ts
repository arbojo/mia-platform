import type { CouncilContext, CouncilRole } from '../types';
import { FindingBuilder } from '../findings/finding-builder';

export class ArchitectRole implements CouncilRole {
  public readonly id = 'architect';
  public readonly name = 'Architect';
  public readonly responsibility = 'Reviews structural impact and coupling risk.';

  public audit(context: CouncilContext) {
    const findings = [];

    if (context.changedFiles.length > 3) {
      findings.push(FindingBuilder.create({
        role: this.name,
        severity: 'medium',
        category: 'architecture',
        title: 'Cambio de arquitectura con alcance amplio',
        description: 'Se detectó una modificación amplia que afecta varios módulos.',
        evidence: context.changedFiles.map((file) => `Archivo modificado: ${file}`),
        affectedArea: 'architecture',
        recommendation: 'Documentar el impacto estructural y revisar el acoplamiento entre módulos.',
      }));
    }

    if (context.evidenceSnapshot.performanceSummary.memorySpikes > 0) {
      findings.push(FindingBuilder.create({
        role: this.name,
        severity: 'low',
        category: 'architecture',
        title: 'Señal de crecimiento de complejidad',
        description: 'Se registró un aumento de uso de memoria que puede indicar presión estructural.',
        evidence: ['Se detectó al menos un spike de memoria'],
        affectedArea: 'architecture',
        recommendation: 'Revisar si el cambio introduce mayor complejidad o carga innecesaria.',
      }));
    }

    return findings;
  }
}
