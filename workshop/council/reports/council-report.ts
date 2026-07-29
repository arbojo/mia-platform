import type { CouncilConsensus } from '../consensus/consensus-model';
import type { CouncilFinding } from '../types';
import type { CouncilReview } from '../reviews/review-model';

export interface CouncilReport {
  sessionId: string;
  findings: CouncilFinding[];
  rolesExecuted: string[];
  reviews: CouncilReview[];
  consensus: CouncilConsensus;
  status: 'needs-attention' | 'monitor' | 'stable';
}
