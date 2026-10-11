import type { WidgetExplanation } from '@/domain/widgetInstances'
import { createContext, useContext } from 'react'
import type { OverdueReview } from '@/domain/overdueReview'
import type { Filters, Task } from '@/domain/types'
import type { ResolvedIntent } from '@/domain/intent'
export const OverdueScopeContext = createContext<{ data: OverdueReview; composition: { widgets: WidgetExplanation[] }; intent: ResolvedIntent; tasks: Task[]; filters: Filters; updateFilters: (patch: Partial<Filters>) => void } | null>(null)
export const useOverdueScope = () => useContext(OverdueScopeContext)
