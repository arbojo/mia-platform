export class InventoryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number = 400
  ) {
    super(message)
    this.name = 'InventoryError'
  }
}

export const InventoryErrorCode = {
  NOT_ENABLED: 'INVENTORY_NOT_ENABLED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  STOCK_CONFLICT: 'STOCK_CONFLICT',
  INVALID_INPUT: 'INVALID_INPUT',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  SKU_NOT_FOUND: 'SKU_NOT_FOUND',
} as const
