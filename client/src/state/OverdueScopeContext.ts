import { createContext, useContext } from 'react'
import type { OverdueReview, OverdueComposition } from '@/domain/overdueReview'
import type { Filters, Task } from '@/domain/types'
import type { ResolvedIntent } from '@/domain/intent'
export const OverdueScopeContext = createContext<{ data: OverdueReview; composition: OverdueComposition; intent: ResolvedIntent; tasks: Task[]; filters: Filters; updateFilters: (patch: Partial<Filters>) => void } | null>(null)
export const useOverdueScope = () => useContext(OverdueScopeContext)
