export class ConfidenceCalculator {
  public calculate(count: number): number {
    if (count <= 1) {
      return 0.4;
    }

    if (count <= 3) {
      return 0.7;
    }

    return 0.95;
  }
}
