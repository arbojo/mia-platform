import type { CouncilConsensus } from './consensus-model';
import type { CouncilReview } from '../reviews/review-model';

export class ConsensusEngine {
  public build(reviews: CouncilReview[]): CouncilConsensus {
    if (reviews.length === 0) {
      return { agreement: 'low', confidence: 0, conflicts: [] };
    }

    const averageConfidence = reviews.reduce((sum, review) => sum + review.confidence, 0) / reviews.length;
    const impacts = reviews.map((review) => review.impact);
    const conflicts = impacts.some((impact) => impact === 'critical')
      ? ['Critical impact identified across multiple reviews.']
      : [];

    let agreement: CouncilConsensus['agreement'] = 'medium';
    if (averageConfidence >= 0.8) {
      agreement = 'high';
    } else if (averageConfidence < 0.5) {
      agreement = 'low';
    }

    return {
      agreement,
      confidence: Number(averageConfidence.toFixed(2)),
      conflicts,
    };
  }
}
