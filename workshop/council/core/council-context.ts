import type { CouncilContext } from '../types';
import { councilContextSchema } from '../schemas';

export class CouncilContextBuilder {
  public build(input: CouncilContext): CouncilContext {
    const parsed = councilContextSchema.parse(input);
    return parsed;
  }
}
