import type { CouncilReport } from './council-report';
import type { CouncilConsensus } from '../consensus/consensus-model';
import type { CouncilFinding } from '../types';
import type { CouncilReview } from '../reviews/review-model';

export class CouncilReportBuilder {
  public build(params: {
    sessionId: string;
    findings: CouncilFinding[];
    rolesExecuted: string[];
    reviews: CouncilReview[];
    consensus: CouncilConsensus;
    status: CouncilReport['status'];
  }): CouncilReport {
    return {
      sessionId: params.sessionId,
      findings: params.findings,
      rolesExecuted: params.rolesExecuted,
      reviews: params.reviews,
      consensus: params.consensus,
      status: params.status,
    };
  }
}
