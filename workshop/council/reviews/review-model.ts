import type { z } from 'zod';
import type { councilReviewSchema } from '../schemas';

export type CouncilReview = z.infer<typeof councilReviewSchema>;
