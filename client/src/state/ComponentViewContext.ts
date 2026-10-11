import { createContext, useContext } from 'react'
import type { ComponentView, ViewBindings } from '@/domain/componentIntent'
import type { Resource } from '@/domain/types'
import type { z } from 'zod'
import { communicationSchema, issueSchema } from '@/domain/adaptiveData'
type Communication = z.infer<typeof communicationSchema>
type Issue = z.infer<typeof issueSchema>
export const ComponentViewContext = createContext<{
  plan: ComponentView; change: (bindings: Partial<ViewBindings>)=>void
  resources: Resource[]; communications: Communication[]; issues: Issue[]
  projects: Array<{id:string;name:string;description:string}>; clients:Array<{id:string;name:string;description:string}>
} | null>(null)
export const useComponentView = () => useContext(ComponentViewContext)
