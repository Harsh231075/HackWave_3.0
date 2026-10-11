import { createContext } from 'react'
import type { UsageQuery } from '@/domain/usage'
import type { WidgetType } from './config'
export const WidgetCanvasContext = createContext<{
  visible: Set<WidgetType>; usageQuery: UsageQuery | null; setUsageQuery: (query: UsageQuery | null) => void
} | null>(null)
