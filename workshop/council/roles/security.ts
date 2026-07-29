import type { CouncilContext, CouncilRole } from '../types';
import { FindingBuilder } from '../findings/finding-builder';

export class SecurityRole implements CouncilRole {
  public readonly id = 'security';
  public readonly name = 'Security';
  public readonly responsibility = 'Reviews sensitive changes and exposure risk.';

  public audit(context: CouncilContext) {
    const findings = [];

    if (context.changedFiles.some((file) => file.includes('auth') || file.includes('token') || file.includes('session'))) {
      findings.push(FindingBuilder.create({
        role: this.name,
        severity: 'high',
        category: 'security',
        title: 'Cambio sensible en autenticación o sesión',
        description: 'Se detectó un cambio en áreas sensibles relacionadas con seguridad.',
        evidence: context.changedFiles.filter((file) => file.includes('auth') || file.includes('token') || file.includes('session')), 
        affectedArea: 'security',
        recommendation: 'Verificar permisos, manejo de sesión y cualquier exposición de secretos.',
      }));
    }

    return findings;
  }
}
