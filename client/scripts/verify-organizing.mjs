import assert from 'node:assert/strict'
import { createServer } from 'vite'
const { chromium } = await import(process.env.ORLO_PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const browser = await chromium.launch({ headless: true, ...(process.env.ORLO_CHROME_PATH ? { executablePath: process.env.ORLO_CHROME_PATH } : {}) })
const base = 'http://127.0.0.1:' + server.httpServer.address().port
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], api = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !new URL(request.url()).pathname.startsWith('/api/calendar/')) api.push(request.url()) })
  await page.goto(base + '/?preview=organizing')
  const loader = page.getByRole('region', { name: 'Organizing your workspace' })
  await loader.getByRole('button', { name: 'Stop', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Stop')
  const saved = await page.evaluate(() => localStorage.getItem('orlo-browser-db-v2'))
  assert.equal(await loader.getByRole('status').count(), 1)
  assert.equal(await loader.getByText('Arranging', { exact: true }).count(), 0)
  assert.equal(await loader.getByRole('button', { name: 'Stop', exact: true }).evaluate(node => getComputedStyle(node).position), 'absolute')
  const sampled = await page.evaluate(async () => {
    let swapped = false
    const swapSamples = []
    const seen = new Set(), counts = new Set(), widths = [], heights = [], secondary = new Set(), extra = new Set(), violations = []
    const start = performance.now()
    while (performance.now() - start < 27000) {
      const nodes = [...document.querySelectorAll('[data-organizing-module]')].filter(node => Number(getComputedStyle(node).opacity) > 0.01), cards = nodes.map(node => node.getBoundingClientRect())
      const agenda = nodes.find(node => node.dataset.organizingModule === 'agenda'), meetings = nodes.find(node => node.dataset.organizingModule === 'meetings')
      if (agenda && meetings) swapSamples.push({ time: (performance.now() - start) / 1000, ax: agenda.getBoundingClientRect().left, ay: agenda.getBoundingClientRect().top, mx: meetings.getBoundingClientRect().left, my: meetings.getBoundingClientRect().top })
      if (agenda && meetings && agenda.getBoundingClientRect().left > meetings.getBoundingClientRect().left && Math.abs(agenda.getBoundingClientRect().top - meetings.getBoundingClientRect().top) < 1) swapped = true
      nodes.forEach(node => seen.add(node.dataset.organizingModule)); counts.add(nodes.length)
      const task = document.querySelector('[data-organizing-module="tasks"]'), taskRect = task.getBoundingClientRect()
      widths.push(taskRect.width); heights.push(taskRect.height)
      secondary.add(getComputedStyle(task.querySelector('.organizing-secondary')).display)
      extra.add(getComputedStyle(task.querySelector('.organizing-extra-row')).display)
      for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) {
        const first = cards[a], second = cards[b]
        if (first.right > second.left + 0.5 && second.right > first.left + 0.5 && first.bottom > second.top + 0.5 && second.bottom > first.top + 0.5) violations.push({ time: Math.round((performance.now() - start) / 10) / 100, kinds: [nodes[a].dataset.organizingModule, nodes[b].dataset.organizingModule], first: { x: first.x, y: first.y, width: first.width, height: first.height }, second: { x: second.x, y: second.y, width: second.width, height: second.height } })
      }
      await new Promise(resolve => setTimeout(resolve, 80))
    }
    return { widthRange: Math.max(...widths) - Math.min(...widths), heightRange: Math.max(...heights) - Math.min(...heights), secondary: [...secondary], extra: [...extra], violations, swapped, swapSamples, seen: [...seen], counts: [...counts] }
  })
  assert.ok(sampled.widthRange > 50, JSON.stringify(sampled)); assert.ok(sampled.heightRange > 30, JSON.stringify(sampled))
  assert.deepEqual(sampled.violations, [])
  assert.ok(sampled.swapped, JSON.stringify(sampled))
  assert.ok(['mail', 'resources', 'agenda', 'meetings', 'timer'].every(kind => sampled.seen.includes(kind)))
  assert.ok([3, 4, 5].every(count => sampled.counts.includes(count)))
  assert.ok(sampled.secondary.includes('none') && sampled.secondary.includes('block'))
  assert.ok(sampled.extra.includes('none') && sampled.extra.includes('flex'))
  await page.screenshot({ path: '/tmp/orlo-organizing-desktop.png' })
  const toggle = page.getByRole('button', { name: /sidebar/i }).first()
  if (await toggle.count()) await toggle.click()
  await page.setViewportSize({ width: 390, height: 650 })
  await page.waitForTimeout(400)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await loader.getByRole('button', { name: 'Stop', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/orlo-organizing-mobile.png' })
  await page.setViewportSize({ width: 390, height: 360 })
  await loader.getByRole('button', { name: 'Stop', exact: true }).scrollIntoViewIfNeeded()
  await loader.getByRole('button', { name: 'Stop', exact: true }).click()
  await loader.waitFor({ state: 'hidden' })
  assert.equal(await page.evaluate(() => localStorage.getItem('orlo-browser-db-v2')), saved)
  await page.reload(); await loader.waitFor()
  await page.keyboard.press('Escape'); await loader.waitFor({ state: 'hidden' })
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await loader.waitFor()
  const before = await page.locator('[data-organizing-module="tasks"]').boundingBox()
  await page.waitForTimeout(1000)
  assert.deepEqual(await page.locator('[data-organizing-module="tasks"]').boundingBox(), before)
  assert.equal(await page.locator('.organizing-dots').count(), 0)
  assert.deepEqual(api, []); assert.deepEqual(errors, [])
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.goto(base + '/')
  let held, announce
  await page.route('**/api/workspace/resolve', route => new Promise(resolve => {
    held = async mode => {
      const input = route.request().postDataJSON()
      await route.fulfill({ json: mode === 'failure' ? { action: 'clarify', question: 'Unable to arrange this request. Try again.', choices: [] } : { action: 'view', widgets: ['tasks'], bindings: {}, referenceDate: input.referenceDate, timezone: input.timezone, reply: 'Task layout ready.' } }).catch(() => {})
      resolve()
    }
    announce()
  }))
  for (const mode of ['success', 'failure', 'cancel']) {
    const requested = new Promise(resolve => { announce = resolve })
    await page.keyboard.press('Control+k')
    await page.getByLabel('Describe the workspace you need', { exact: true }).fill('Arrange tasks for my day')
    await page.getByRole('button', { name: 'Build workspace', exact: true }).click()
    await requested; await loader.getByRole('button', { name: 'Stop', exact: true }).waitFor()
    if (mode === 'cancel') await loader.getByRole('button', { name: 'Stop', exact: true }).click()
    await held(mode); await loader.waitFor({ state: 'hidden' })
    if (mode === 'failure') await page.keyboard.press('Escape')
  }
  assert.deepEqual(errors, [])
  console.log('PASS: two loops without collisions, adaptive skeletons, mobile/sidebar, Stop/Escape, saved-state protection, reduced motion; preview makes no AI requests; generation completion/failure/cancel')
} finally { await browser.close(); await server.close() }
