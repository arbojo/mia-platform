export class DeliveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number = 400
  ) {
    super(message)
    this.name = 'DeliveryError'
  }
}

export const DeliveryErrorCode = {
  NOT_ENABLED: 'DELIVERY_NOT_ENABLED',
  UNAUTHORIZED: 'DRIVER_UNAUTHORIZED',
  FORBIDDEN: 'DRIVER_FORBIDDEN',
  CLOSURE_PENDING: 'CLOSURE_PENDING',
  WRONG_STATUS: 'WRONG_STATUS',
  GPS_REJECTED: 'GPS_REJECTED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_INPUT: 'INVALID_INPUT',
} as const
