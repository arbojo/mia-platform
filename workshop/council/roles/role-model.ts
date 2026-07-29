import type { z } from 'zod';
import type { councilRoleDefinitionSchema } from '../schemas';

export type CouncilRoleDefinition = z.infer<typeof councilRoleDefinitionSchema>;
