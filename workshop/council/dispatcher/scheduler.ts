import type { CouncilContext, CouncilRole } from '../types';

export interface ScheduleResult {
  rolesToExecute: CouncilRole[];
}

export class Scheduler {
  public schedule(roles: CouncilRole[], _context: CouncilContext): ScheduleResult {
    return { rolesToExecute: roles };
  }
}
