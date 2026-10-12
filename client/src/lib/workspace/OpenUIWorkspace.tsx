import { widgetLayoutCatalog } from '@/domain/widgetLayout'
import { useWorkspaceActions } from './WorkspaceActionContext'
import { workspaceActionSchema } from '@/domain/workspaceActions'
import { Button } from '@/components/ui/button'
import { createLibrary, defineComponent } from '@openuidev/react-lang'
import { openuiChatLibrary } from '@openuidev/react-ui/genui-lib'
import { generateSystemPrompt } from '@openuidev/lang-core'
import { z } from 'zod'
import { widgetTypes } from './config'
import { registry } from './registry'
import { WorkspaceRenderer as StaticWorkspaceRenderer } from './WorkspaceRenderer'

const WorkspaceWidget = defineComponent({
  name: 'WorkspaceWidget',
  props: z.object({ id: z.enum(widgetTypes), span: z.enum(['wide', 'narrow', 'full']), version: z.number().int().positive().optional() }),
  description: 'An existing productivity widget. Use unique IDs and a supported numbered presentation version; the application calculates dimensions. Widgets read and edit shared workspace records.',
  component: () => null,
})
const Workspace = defineComponent({
  name: 'Workspace',
  props: z.object({ children: z.array(WorkspaceWidget.ref).min(1).max(14) }),
  description: 'The productivity canvas root. Arrange only approved WorkspaceWidget children; never invent records or task counts.',
  component: () => null,
})

const WorkspaceAction = defineComponent({
  name: 'WorkspaceAction',
  props: z.object({ label: z.string().trim().min(1).max(80), action: workspaceActionSchema }),
  description: 'Working application button. action is task.edit {taskId}, draft.edit {}, focus.schedule {taskId,date?}, or goal.change {goal}. Scope is owned by the application. Editors require user confirmation.',
  component: function WorkspaceActionView({ props }) {
    const actions = useWorkspaceActions()
    return <Button className="mr-2 mt-3" variant="outline" disabled={!actions || actions.pending} onClick={() => actions?.dispatch(props.action)}>{props.label}</Button>
  },
})

const baseCard = openuiChatLibrary.components.Card
const ProductivityCard = defineComponent({
  name: 'Card',
  props: baseCard.props.extend({ children: z.array(z.union([baseCard.props.shape.children.element, Workspace.ref, WorkspaceAction.ref])).min(1) }),
  description: 'Response root. Combine explanatory content, questions, and a Workspace canvas of relevant productivity widgets.',
  component: ({ props, renderNode }) => <div className="productivity-response">{renderNode(props.children)}</div>,
})

export const productivityLibrary = createLibrary({
  root: 'Card',
  components: [...Object.values(openuiChatLibrary.components).filter(component => component.name !== 'Card'), ProductivityCard, WorkspaceWidget, Workspace, WorkspaceAction],
  componentGroups: [
    ...(openuiChatLibrary.componentGroups ?? []),
    { name: 'Productivity', components: ['Workspace', 'WorkspaceWidget', 'WorkspaceAction'], notes: widgetTypes.map(id => `${id}: ${registry[id].reason} Layout versions: ${JSON.stringify(widgetLayoutCatalog[id])}`) },
  ],
})

// This specification can be sent to the server when model transport is connected.
export function productivitySystemPrompt() {
  return generateSystemPrompt(productivityLibrary.toSpec())
}

export function OpenUIWorkspace({ config }: { config: unknown }) {
  return <StaticWorkspaceRenderer config={config} />
}
