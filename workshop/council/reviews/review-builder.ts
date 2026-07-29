import type { CouncilReview } from './review-model';

export class ReviewBuilder {
  public static create(params: {
    roleId: string;
    findingId: string;
    observations: string;
    impact: CouncilReview['impact'];
    confidence: number;
  }): CouncilReview {
    return {
      id: `${params.roleId}-${params.findingId}-${Date.now()}`,
      roleId: params.roleId,
      findingId: params.findingId,
      observations: params.observations,
      impact: params.impact,
      confidence: params.confidence,
    };
  }
}
