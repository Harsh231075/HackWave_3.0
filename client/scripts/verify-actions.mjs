// Optional Playwright browser test; dependencies remain external to the application.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const { chromium } = await import(process.env.ORLO_PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ headless: true, ...(process.env.ORLO_CHROME_PATH ? { executablePath: process.env.ORLO_CHROME_PATH } : {}) })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(15000)
const errors = []; page.on('pageerror', e => errors.push(e.message))
let calls = 0, lastGoal = '', invalid = false
await page.route('**/api/intent', async route => {
 const input = route.request().postDataJSON(); calls++; lastGoal = input.goal
 const intent = input.goal.includes('overdue') ? { goalType: 'overdue_review', dateRange: { from: '0001-01-01', to: '2026-10-11' } } : { goalType: 'meeting_preparation', meetingId: 'northstar-meeting', dateRange: { from: '2026-10-13', to: '2026-10-13' } }
 if (input.goal.includes('ambiguous') && !input.clarificationAnswer) {
   const choices = input.candidates.meetings.filter(m => ['northstar-meeting','westbridge-meeting'].includes(m.id)).map(m => ({ id: m.id, label: m.label }))
   await route.fulfill({ json: { version: 2, requestId: input.requestId, originalGoal: input.goal, status: 'needs_clarification', question: 'Which meeting?', field: 'meetingId', choices, partialIntent: { goalType: 'meeting_preparation', dateRange: intent.dateRange } } }); return
 }
 await route.fulfill({ json: { version: 2, requestId: input.requestId, originalGoal: input.goal, status: 'resolved', intent } })
})
await page.route('**/api/workspace/compose', async route => {
 const input = route.request().postDataJSON(), data = input.preparation ?? input.review, task = data.tasks.find(t => t.status === 'pending') ?? data.tasks[0]
 const types = input.preparation ? ['context','outline','tasks'] : ['context','tasks','recommendation']
 const actions = [{ label: 'Edit linked task', action: { type: 'task.edit', taskId: task.id } }, ...(task.status === 'pending' ? [{ label: 'Schedule linked task', action: { type: 'focus.schedule', taskId: task.id } }] : []), ...(input.preparation ? [{ label: 'Edit meeting agenda', action: { type: 'draft.edit' } }] : []), { label: 'Change goal now', action: { type: 'goal.change', goal: input.preparation ? 'Review overdue work' : 'Prepare ambiguous meeting' } }]
 await route.fulfill({ json: { version: 2, requestId: input.requestId, widgets: types.map(type => ({ type, span: 'full', reason: 'Linked records.', evidence: [{ kind: input.preparation ? 'meeting' : 'task', id: input.preparation ? input.intent.meetingId : task.id }] })), actions: invalid ? [{ label: 'Bad action', action: { type: 'task.edit', taskId: 'missing' } }] : actions } })
})
const active = () => page.locator('.productivity-response')
async function goal(text) {
 await page.keyboard.press('Control+k'); await page.getByRole('textbox',{name:'Describe the workspace you need'}).fill(text); await page.getByRole('button',{name:'Build workspace'}).click(); await page.getByRole('dialog').waitFor({state:'hidden'})
}
async function close() { await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'hidden'}) }
try {
 await page.goto(base)

  const { INITIAL_TASKS, INITIAL_EVENTS, RESOURCES } = await server.ssrLoadModule('/../server/fixtures/demo.ts')
  const { ADAPTIVE_DEMO } = await server.ssrLoadModule('/../server/fixtures/adaptiveDemo.ts')
  const { USAGE_DEMO } = await server.ssrLoadModule('/../server/fixtures/usageDemo.ts')
  await page.waitForSelector('[data-instance-id]')
  await page.evaluate(async data => { const s = await import('/src/services/index.ts'); s.browserDatabase.replaceAll(data.records, { notes: [], files: [], ...data.collections }) }, { records: { tasks: INITIAL_TASKS, events: INITIAL_EVENTS, drafts: {}, dismissed: [], activity: [] }, collections: { ...ADAPTIVE_DEMO, ...USAGE_DEMO, resources: RESOURCES } })
; await goal('Prepare Northstar meeting')
 await active().getByRole('textbox',{name:'Search tasks'}).fill('hide all tasks')
 await page.getByRole('button',{name:'Edit linked task',exact:true}).click()
 const originalTitle = await page.getByRole('textbox',{name:'Task title'}).inputValue()
 await page.getByRole('textbox',{name:'Task title'}).fill('Rejected stale edit')
 await page.evaluate(async title => { const {taskService}=await import('/src/services/index.ts'); const task=taskService.list().find(t=>t.title===title); taskService.update(task.id,{title:'External task change'}) }, originalTitle)
 await page.getByRole('button',{name:'Save changes'}).click()
 await page.getByRole('dialog').getByRole('alert').filter({hasText:'Task changed'}).waitFor()
 assert.equal(await page.getByRole('textbox',{name:'Task title'}).inputValue(),'Rejected stale edit')
 await close(); await page.getByRole('button',{name:'Edit linked task',exact:true}).click()
 await page.getByRole('textbox',{name:'Task title'}).fill('Action edited task'); await page.getByRole('button',{name:'Save changes'}).click(); await page.getByRole('dialog').waitFor({state:'hidden'})
 await active().getByRole('textbox',{name:'Search tasks'}).fill(''); assert.match(await active().innerText(),/Action edited task/)
 await page.getByRole('button',{name:'Edit meeting agenda',exact:true}).click(); await page.getByRole('dialog').getByRole('textbox',{name:'Meeting agenda'}).fill('Unsaved action agenda')
 await page.evaluate(async()=>{const {draftService}=await import('/src/services/index.ts');draftService.save('meeting-agenda:northstar-meeting','External saved agenda')})
 await page.getByRole('dialog').getByRole('button',{name:'Save draft'}).click()
 await page.getByRole('dialog').getByRole('alert').filter({hasText:'saved draft'}).waitFor()
 assert.equal(await page.getByRole('dialog').getByRole('textbox',{name:'Meeting agenda'}).inputValue(),'Unsaved action agenda')
 await close()
 assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Edit meeting agenda')
 assert.equal(await active().getByRole('textbox',{name:'Meeting agenda'}).inputValue(),'Unsaved action agenda')
 await page.getByRole('button',{name:'Edit meeting agenda',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Save draft'}).click(); await close()
 await page.getByRole('button',{name:'Schedule linked task',exact:true}).click(); await page.getByLabel('Focus date').fill('2026-10-14')
 const select=page.getByLabel('Available focus time'), start=await select.locator('option').nth(1).getAttribute('value'); await select.selectOption(start); await page.getByRole('button',{name:'Confirm focus time'}).click(); await page.getByRole('dialog').waitFor({state:'hidden'})
 await page.reload(); assert.equal(await active().getByRole('textbox',{name:'Meeting agenda'}).inputValue(),'Unsaved action agenda')
 const events=await page.evaluate(()=>JSON.parse(localStorage.getItem('orlo-data-v2')).events); assert.ok(events.some(e=>e.title==='Focus: Action edited task'&&e.date==='2026-10-14'&&e.start===start))
 const before=calls; await page.getByRole('button',{name:'Change goal now',exact:true}).click(); await active().locator('.widget-recommendation').waitFor(); assert.equal(lastGoal,'Review overdue work'); assert.equal(calls,before+1)
 await active().locator('.widget-recommendation').getByRole('button',{name:/^Pin /}).click()
 await page.getByRole('button',{name:'Change goal now',exact:true}).click(); await page.getByRole('dialog').getByText('Which meeting?',{exact:true}).waitFor(); await page.getByRole('button',{name:'Cancel',exact:true}).click()
 await goal('Prepare Northstar meeting'); await page.getByRole('region',{name:'Pinned views'}).getByRole('button',{name:'Edit task',exact:true}).click(); await page.getByRole('dialog').getByRole('textbox',{name:'Task title'}).waitFor(); await close()
 invalid=true; await page.keyboard.press('Control+k'); await page.getByRole('textbox',{name:'Describe the workspace you need'}).fill('Prepare Northstar meeting'); await page.getByRole('button',{name:'Build workspace'}).click(); await page.getByRole('alert').filter({hasText:'invalid'}).waitFor(); await close(); assert.equal(await active().locator('.widget-outline').count(),1)
 await page.setViewportSize({width:390,height:844}); await page.getByRole('button',{name:'Edit meeting agenda',exact:true}).click(); assert.ok(await page.getByRole('dialog').getByRole('textbox',{name:'Meeting agenda'}).isVisible()); await close()
 assert.deepEqual(errors,[]); console.log('Actions passed: scoped editors despite filters, buffers/save/reload, scheduling persistence, immediate goals, clarification/cancel, pin editors, invalid output preservation, mobile. No page errors.')
} finally { await browser.close(); await server.close() }
