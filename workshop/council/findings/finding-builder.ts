import type { CouncilFinding, CouncilSeverity } from '../types';

export class FindingBuilder {
  public static create(params: {
    role: string;
    severity: CouncilSeverity;
    category: string;
    title: string;
    description: string;
    evidence: string[];
    affectedArea: string;
    recommendation: string;
  }): CouncilFinding {
    return {
      id: `${params.role.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: params.role,
      severity: params.severity,
      category: params.category,
      title: params.title,
      description: params.description,
      evidence: params.evidence,
      affectedArea: params.affectedArea,
      recommendation: params.recommendation,
    };
  }
}
