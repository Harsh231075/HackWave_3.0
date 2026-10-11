import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } })
try {
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.tsx')
  const { GoogleCalendarProvider } = await server.ssrLoadModule('/src/state/GoogleCalendarProvider.tsx')
  const { DisplayPreferencesProvider } = await server.ssrLoadModule('/src/state/DisplayPreferencesProvider.tsx')
  const { DynamicWorkspace } = await server.ssrLoadModule('/src/pages/DynamicWorkspace.tsx')
  const { WorkspaceRenderer } = await server.ssrLoadModule('/src/lib/workspace/WorkspaceRenderer.tsx')
  const { InstanceCanvas } = await server.ssrLoadModule('/src/lib/workspace/InstanceCanvas.tsx')
  const { makeInstance } = await server.ssrLoadModule('/src/services/workspaceDocumentService.ts')
  const { PageHeaderContext } = await server.ssrLoadModule('/src/components/shell/pageHeaderContext.ts')
  const wrap = content => React.createElement(MemoryRouter, null, React.createElement(WorkspaceProvider, null, React.createElement(GoogleCalendarProvider, null, React.createElement(DisplayPreferencesProvider, null, React.createElement(PageHeaderContext.Provider, { value: { target: null, register: () => () => {} } }, content)))))
  const dynamic = renderToString(wrap(React.createElement(DynamicWorkspace)))
  assert.match(dynamic, /Generated productivity workspace/)
  assert.match(dynamic, /data-instance-id/)
  assert.doesNotMatch(dynamic, /All workspace records/)
  assert.match(dynamic, /Active workspace/)
  assert.match(dynamic, /Ctrl \/ Cmd \+ K to update/)
  assert.doesNotMatch(dynamic, /<details|<summary/)
  const scoped = renderToString(wrap(React.createElement(InstanceCanvas, { instances: [makeInstance('tasks', { kind: 'workspace', projectId: 'atlas' }, {}, 'first'), makeInstance('tasks', { kind: 'workspace', projectId: 'launch' }, {}, 'second')], update: () => {} })))
  assert.match(scoped, /data-instance-id="first"/); assert.match(scoped, /data-instance-id="second"/)
  assert.doesNotMatch(scoped, /original records are unavailable/)
  const staticView = renderToString(wrap(React.createElement(WorkspaceRenderer, { config: { version: 1, id: 'tasks', title: 'Tasks', description: '', widgets: [{ id: 'tasks', span: 'full' }] } })))
  assert.match(staticView, /data-instance-id/)
  const { productivityLibrary } = await server.ssrLoadModule('/src/lib/workspace/OpenUIWorkspace.tsx')
  const { extractActiveWidgets, extractGeneratedActions, extractGeneratedText } = await server.ssrLoadModule('/src/lib/workspace/workspaceNodes.ts')
  const response = 'root = Card([TextContent("A scoped workspace"), Workspace([WorkspaceWidget("tasks", "wide")]), WorkspaceAction("Edit task", {"type":"task.edit","taskId":"task-3"})])'
  const library = productivityLibrary.toJSONSchema(), root = productivityLibrary.root
  assert.deepEqual(extractActiveWidgets(response, library, root), [{ id: 'tasks', span: 'wide' }])
  assert.equal(extractGeneratedActions(response, library, root)[0].action.taskId, 'task-3')
  assert.equal(extractGeneratedText(response, library, root), 'A scoped workspace')
  console.log('Render smoke checks passed: default/static canvas, independent project views, generated text/actions adapter.')
} finally { await server.close() }
