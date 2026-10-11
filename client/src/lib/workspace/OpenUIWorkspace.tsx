import { useResponseWidgets } from '@/state/ResponseWidgetsContext'
import { useUsageScope } from '@/state/UsageScopeContext'
import { usageWidgetTypes } from '@/domain/usageComposition'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { overdueWidgetTypes } from '@/domain/overdueReview'
import { meetingWidgetTypes } from '@/domain/adaptiveData'
import { useMeetingScope } from '@/hooks/useMeetingScope'
import { UnscopedWidget } from '@/state/MeetingScope'
import { createLibrary, defineComponent, Renderer } from '@openuidev/react-lang'
import { openuiChatLibrary } from '@openuidev/react-ui/genui-lib'
import { generateSystemPrompt } from '@openuidev/lang-core'
import { z } from 'zod'
import { configSchema, widgetTypes } from './config'
import { registry } from './registry'
import { WidgetFrame, WorkspaceRenderer as StaticWorkspaceRenderer } from './WorkspaceRenderer'
import { useWorkspace } from '@/state/WorkspaceProvider'

const WorkspaceWidget = defineComponent({
  name: 'WorkspaceWidget',
  props: z.object({ id: z.enum(widgetTypes), span: z.enum(['wide', 'narrow', 'full']) }),
  description: 'An existing productivity widget. Use unique IDs; metrics and tasks normally span full. Widgets read and edit shared workspace records.',
  component: function WorkspaceWidgetView({ props }) {
    const meeting = useMeetingScope()
    const overdue = useOverdueScope()
    const usage = useUsageScope()
    const scope = usage ?? overdue ?? meeting
    const visible = useResponseWidgets()
    if (visible && !visible.includes(props.id)) return null
    const Widget = registry[props.id].component
    const supported = !scope || scope.composition.widgets.some(widget => widget.type === props.id)
    const content = props.id === 'metrics' && !overdue && !usage ? <Widget /> : <WidgetFrame id={props.id}><Widget /></WidgetFrame>
    return <div className={`workspace-cell span-${props.span}`}>
      {supported ? content : <UnscopedWidget><p className="mb-2 text-xs text-muted-foreground">Pinned · all workspace records</p>{content}</UnscopedWidget>}
    </div>
  },
})
const Workspace = defineComponent({
  name: 'Workspace',
  props: z.object({ children: z.array(WorkspaceWidget.ref).min(1).max(15) }),
  description: 'The productivity canvas root. Arrange only approved WorkspaceWidget children; never invent records or task counts.',
  component: function WorkspaceView({ props, renderNode }) {
    const meeting = useMeetingScope()
    const overdue = useOverdueScope()
    const usage = useUsageScope()
    const scope = usage ?? overdue ?? meeting
    const { state } = useWorkspace()
    const visible = useResponseWidgets()
    const present = scope?.composition.widgets.map(widget => widget.type) ?? []
    const retained = scope && !visible ? state.pins.filter(id => widgetTypes.includes(id as typeof widgetTypes[number]) && !present.includes(id as typeof present[number])) : []
    return <div className="workspace-grid">{renderNode(props.children)}{retained.map(id => {
      const widgetId = id as typeof widgetTypes[number]
      const Widget = registry[widgetId].component
      return <div key={id} className="workspace-cell span-full">{(usage ? (usageWidgetTypes as readonly string[]).includes(widgetId) : overdue ? (overdueWidgetTypes as readonly string[]).includes(widgetId) : meetingWidgetTypes.includes(widgetId as typeof meetingWidgetTypes[number])) ? <WidgetFrame id={widgetId}><Widget /></WidgetFrame> : <UnscopedWidget><p className="mb-2 text-xs text-muted-foreground">Pinned · all workspace records</p><WidgetFrame id={widgetId}><Widget /></WidgetFrame></UnscopedWidget>}</div>
    })}</div>
  },
})

const baseCard = openuiChatLibrary.components.Card
const ProductivityCard = defineComponent({
  name: 'Card',
  props: baseCard.props.extend({ children: z.array(z.union([baseCard.props.shape.children.element, Workspace.ref])).min(1) }),
  description: 'Response root. Combine explanatory content, questions, and a Workspace canvas of relevant productivity widgets.',
  component: ({ props, renderNode }) => <div className="productivity-response">{renderNode(props.children)}</div>,
})

export const productivityLibrary = createLibrary({
  root: 'Card',
  components: [...Object.values(openuiChatLibrary.components).filter(component => component.name !== 'Card'), ProductivityCard, WorkspaceWidget, Workspace],
  componentGroups: [
    ...(openuiChatLibrary.componentGroups ?? []),
    { name: 'Productivity', components: ['Workspace', 'WorkspaceWidget'], notes: widgetTypes.map(id => `${id}: ${registry[id].reason}`) },
  ],
})

// This specification can be sent to the server when model transport is connected.
export function productivitySystemPrompt() {
  return generateSystemPrompt(productivityLibrary.toSpec())
}

export function OpenUIWorkspace({ config }: { config: unknown }) {
  const { state } = useWorkspace()
  const parsed = configSchema.safeParse(config)
  if (!parsed.success) return <StaticWorkspaceRenderer config={config} />
  const widgets = [...parsed.data.widgets]
  for (const pinned of state.pins) {
    const result = z.enum(widgetTypes).safeParse(pinned)
    if (!result.success) continue
    const id = result.data
    if (!widgets.some(widget => widget.id === id)) widgets.push({ id, span: id === 'metrics' ? 'full' : 'narrow' })
  }
  const response = `root = Workspace([${widgets.map(widget => `WorkspaceWidget(${JSON.stringify(widget.id)}, ${JSON.stringify(widget.span)})`).join(', ')}])`
  return <Renderer library={productivityLibrary} response={response} isStreaming={false} />
}
