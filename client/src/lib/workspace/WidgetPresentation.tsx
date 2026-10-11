import { createContext, useContext } from 'react'
import type { LayoutVariant } from '@/domain/widgetLayout'
export const WidgetPresentationContext = createContext<{ variant: LayoutVariant; width: number } | null>(null)
export function useWidgetPresentation() { return useContext(WidgetPresentationContext) }
