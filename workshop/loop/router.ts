export const WORKER_MODELS = {
  nemotron: 'opencode/nemotron-3-ultra-free',
  'big-pickle': 'opencode/big-pickle',
} as const

export type WorkerName = keyof typeof WORKER_MODELS

export const PRIMARY_WORKER: WorkerName = 'nemotron'
export const FALLBACK_WORKER: WorkerName = 'big-pickle'

export function modelFor(worker: WorkerName): string {
  return WORKER_MODELS[worker]
}
