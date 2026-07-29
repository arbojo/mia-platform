import type { CouncilContext, CouncilRole } from '../types';
import { FindingBuilder } from '../findings/finding-builder';

export class ProductRole implements CouncilRole {
  public readonly id = 'product';
  public readonly name = 'Product';
  public readonly responsibility = 'Reviews functional impact and user experience.';

  public audit(context: CouncilContext) {
    const findings = [];

    if (context.evidenceSnapshot.warningCount > 0) {
      findings.push(FindingBuilder.create({
        role: this.name,
        severity: 'low',
        category: 'product',
        title: 'Se detectaron advertencias de experiencia',
        description: 'La evidencia incluye advertencias que podrían impactar la experiencia del usuario.',
        evidence: [`Advertencias registradas: ${context.evidenceSnapshot.warningCount}`],
        affectedArea: 'product',
        recommendation: 'Revisar las advertencias para confirmar si el flujo sigue siendo claro para el usuario.',
      }));
    }

    return findings;
  }
}
