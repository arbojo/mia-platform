import type { z } from 'zod';
import type { councilConsensusSchema } from '../schemas';

export type CouncilConsensus = z.infer<typeof councilConsensusSchema>;
