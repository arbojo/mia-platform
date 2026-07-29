import type { CouncilContext, CouncilDecisionFrameworkContext } from '../types';
import { councilContextSchema } from '../schemas';

export class CouncilContextBuilder {
  public build(input: CouncilContext & CouncilDecisionFrameworkContext): CouncilContext & CouncilDecisionFrameworkContext {
    const parsed = councilContextSchema.parse(input);
    return parsed as CouncilContext & CouncilDecisionFrameworkContext;
  }
}
