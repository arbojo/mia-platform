import type { CouncilContext, CouncilRole } from '../types';
import { FindingBuilder } from '../findings/finding-builder';

export class QARole implements CouncilRole {
  public readonly id = 'qa';
  public readonly name = 'QA';
  public readonly responsibility = 'Reviews regression risk and test evidence.';

  public audit(context: CouncilContext) {
    const findings = [];

    if (!context.validationResults.tests) {
      findings.push(FindingBuilder.create({
        role: this.name,
        severity: 'high',
        category: 'testing',
        title: 'Cambio sin prueba asociada',
        description: 'La validación de tests no está disponible para este contexto.',
        evidence: ['No se registró validación de tests'],
        affectedArea: 'testing',
        recommendation: 'Relacionar el cambio con pruebas específicas antes de cerrarlo.',
      }));
    }

    if (context.evidenceSnapshot.errorCount > 0) {
      findings.push(FindingBuilder.create({
        role: this.name,
        severity: 'medium',
        category: 'testing',
        title: 'Se detectaron errores en la evidencia',
        description: 'La evidencia incluye errores que deberían revisarse como posibles regresiones.',
        evidence: [`Errores registrados: ${context.evidenceSnapshot.errorCount}`],
        affectedArea: 'testing',
        recommendation: 'Revisar los eventos de error y validar su impacto sobre el comportamiento.',
      }));
    }

    return findings;
  }
}
