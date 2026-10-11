import { useSyncExternalStore } from 'react'
import { mailService } from './mailRuntime.ts'
export const useMail = () => useSyncExternalStore(mailService.subscribe, mailService.getSnapshot, mailService.getSnapshot)
