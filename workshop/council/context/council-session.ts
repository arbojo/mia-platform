import type { CouncilFinding } from '../types';
import type { CouncilReview } from '../reviews/review-model';
import type { CouncilRoleDefinition } from '../roles/role-model';
import type { CouncilConsensus } from '../consensus/consensus-model';

export interface CouncilSessionContext {
  sessionId: string;
  findings: CouncilFinding[];
  availableRoles: CouncilRoleDefinition[];
  reviews: CouncilReview[];
  consensus: CouncilConsensus;
}
