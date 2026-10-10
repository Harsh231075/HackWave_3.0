import { useCallback, useEffect, useRef, useState } from 'react'
import { generationService } from '@/services'
import type { GenerateWorkspaceInput, GenerationService } from '@/services/contracts'
import { repairOpenUI, validLayout } from '@/lib/workspace/layoutValidation'
export function useWorkspaceGeneration(service: GenerationService = generationService) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const cancel = useCallback(() => { request.current?.abort(); request.current = null; setPending(false) }, [])
  useEffect(() => () => { request.current?.abort(); request.current = null }, [])
  const generate = async (input: GenerateWorkspaceInput): Promise<string | null> => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPending(true); setError('')
    try {
      const body = await service.generate(input, { signal: controller.signal })
      if (controller.signal.aborted || request.current !== controller) return null
      const response = repairOpenUI(body.response)
      if (!validLayout(response)) throw new Error('The generated layout could not be validated. Try describing your goal more precisely.')
      return response
    } catch (failure) {
      if (!controller.signal.aborted && request.current === controller) setError(failure instanceof Error ? failure.message : 'Unable to build your workspace.')
      return null
    } finally { if (request.current === controller) { request.current = null; setPending(false) } }
  }
  return { pending, error, setError, generate, cancel }
}
