export class ServiceError extends Error {
  readonly code: 'input' | 'network' | 'http' | 'response'
  readonly status?: number
  constructor(code: ServiceError['code'], message: string, status?: number) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.status = status
  }
}
export const isServiceError = (error: unknown): error is ServiceError => error instanceof ServiceError
