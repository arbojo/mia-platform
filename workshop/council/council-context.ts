import type { CouncilContext } from './types';
import { councilContextSchema } from './schemas';

export class CouncilContextBuilder {
  public build(input: CouncilContext & {
    artifacts?: string[];
    git?: Record<string, unknown>;
    affectedModules?: string[];
    timeline?: string[];
  }): CouncilContext & {
    artifacts?: string[];
    git?: Record<string, unknown>;
    affectedModules?: string[];
    timeline?: string[];
  } {
    const parsed = councilContextSchema.parse(input);
    return parsed as CouncilContext & {
      artifacts?: string[];
      git?: Record<string, unknown>;
      affectedModules?: string[];
      timeline?: string[];
    };
  }
}
