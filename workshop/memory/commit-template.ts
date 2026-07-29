export interface CommitTemplateData {
  type: string;
  scope: string;
  description: string;
  why: string;
  implemented: string[];
  validation: string[];
  impact: string;
  future: string;
}

export class CommitTemplateSystem {
  public render(data: CommitTemplateData): string {
    return [
      `${data.type}(${data.scope}): ${data.description}`,
      '',
      'Why:',
      data.why,
      '',
      'Implemented:',
      ...data.implemented.map((item) => `- ${item}`),
      '',
      'Validation:',
      ...data.validation.map((item) => `- ${item}`),
      '',
      'Impact:',
      data.impact,
      '',
      'Future:',
      data.future,
    ].join('\n');
  }
}
