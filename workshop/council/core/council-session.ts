import type { CouncilAuditReport, CouncilContext, CouncilRole } from '../types';
import { CouncilEngine } from './council-engine';
import { CouncilContextBuilder } from './council-context';

export class CouncilSession {
  private readonly engine: CouncilEngine;
  private readonly contextBuilder: CouncilContextBuilder;

  constructor(roles: CouncilRole[] = []) {
    this.engine = new CouncilEngine(roles);
    this.contextBuilder = new CouncilContextBuilder();
  }

  public audit(input: CouncilContext): CouncilAuditReport {
    const context = this.contextBuilder.build(input);
    return this.engine.run(context);
  }
}
