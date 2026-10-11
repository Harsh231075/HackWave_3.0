import type { WidgetExplanation } from '@/domain/widgetInstances'
import type { Task, Filters } from '@/domain/types'
import { createContext, useContext } from 'react'
import type { UsageWorkspace } from '@/services/usageWorkspaceService'
import type { ResolvedIntent } from '@/domain/intent'
export const UsageScopeContext = createContext<{ data: UsageWorkspace; tasks: Task[]; filters: Filters; updateFilters: (patch: Partial<Filters>) => void; composition: { widgets: WidgetExplanation[] }; evidenceChanged: boolean; intent: ResolvedIntent } | null>(null)
export const useUsageScope = () => useContext(UsageScopeContext)
