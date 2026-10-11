import { useWorkspaceActions } from './WorkspaceActionContext'
import { workspaceActionSchema } from '@/domain/workspaceActions'
import { Button } from '@/components/ui/button'
import { useContext } from 'react'
import { WidgetCanvasContext } from './WidgetCanvasContext'
import { useUsageScope } from '@/state/UsageScopeContext'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { useMeetingScope } from '@/hooks/useMeetingScope'
import { createLibrary, defineComponent, Renderer } from '@openuidev/react-lang'
import { openuiChatLibrary } from '@openuidev/react-ui/genui-lib'
import { generateSystemPrompt } from '@openuidev/lang-core'
import { z } from 'zod'
import { configSchema, widgetTypes } from './config'
import { registry } from './registry'
import { WidgetFrame, WorkspaceRenderer as StaticWorkspaceRenderer } from './WorkspaceRenderer'

const WorkspaceWidget = defineComponent({
  name: 'WorkspaceWidget',
  props: z.object({ id: z.enum(widgetTypes), span: z.enum(['wide', 'narrow', 'full']) }),
  description: 'An existing productivity widget. Use unique IDs; metrics and tasks normally span full. Widgets read and edit shared workspace records.',
  component: function WorkspaceWidgetView({ props }) {
    const meeting = useMeetingScope()
    const overdue = useOverdueScope()
    const usage = useUsageScope()
    const scope = usage ?? overdue ?? meeting
    const Widget = registry[props.id].component
    const supported = !scope || scope.composition.widgets.some(widget => widget.type === props.id)
    const canvas = useContext(WidgetCanvasContext)
    if (canvas && !canvas.visible.has(props.id)) return null
    if (!supported) return null
    const content = <WidgetFrame id={props.id} span={props.span}><Widget /></WidgetFrame>
    return <div className={`workspace-cell span-${props.span}`}>
      {content}
    </div>
  },
})
const Workspace = defineComponent({
  name: 'Workspace',
  props: z.object({ children: z.array(WorkspaceWidget.ref).min(1).max(14) }),
  description: 'The productivity canvas root. Arrange only approved WorkspaceWidget children; never invent records or task counts.',
  component: function WorkspaceView({ props, renderNode }) {
    return <div className="workspace-grid">{renderNode(props.children)}</div>
  },
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
    { name: 'Productivity', components: ['Workspace', 'WorkspaceWidget', 'WorkspaceAction'], notes: widgetTypes.map(id => `${id}: ${registry[id].reason}`) },
  ],
})

// This specification can be sent to the server when model transport is connected.
export function productivitySystemPrompt() {
  return generateSystemPrompt(productivityLibrary.toSpec())
}

export function OpenUIWorkspace({ config }: { config: unknown }) {
  const parsed = configSchema.safeParse(config)
  if (!parsed.success) return <StaticWorkspaceRenderer config={config} />
  const widgets = [...parsed.data.widgets]
  const response = `root = Workspace([${widgets.map(widget => `WorkspaceWidget(${JSON.stringify(widget.id)}, ${JSON.stringify(widget.span)})`).join(', ')}])`
  return <Renderer library={productivityLibrary} response={response} isStreaming={false} />
}
