import type { CouncilFinding } from '../types';
import type { CouncilRoleDefinition } from './role-model';

export class RoleRegistry {
  constructor(private readonly roles: CouncilRoleDefinition[] = []) {}

  public register(role: CouncilRoleDefinition): void {
    this.roles.push(role);
  }

  public getAll(): CouncilRoleDefinition[] {
    return [...this.roles];
  }

  public getById(id: string): CouncilRoleDefinition | undefined {
    return this.roles.find((role) => role.id === id);
  }

  public getRolesForFinding(finding: CouncilFinding): CouncilRoleDefinition[] {
    const normalizedCategory = finding.category.toUpperCase();
    return this.roles.filter((role) => role.inputTypes.some((type) => type.toUpperCase() === normalizedCategory));
  }
}
