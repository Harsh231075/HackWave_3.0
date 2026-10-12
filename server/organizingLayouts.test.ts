import { test } from 'node:test'
import assert from 'node:assert/strict'
import { organizingCanvas, organizingLayouts, organizingRect, organizingFrames, organizingVisibility, organizingTimes, organizingSteps, organizingDuration } from '../client/src/components/feedback/organizingLayouts.ts'
test('organizing cards stay inside the canvas and keep their gap across every transition', () => {
  for (let phase = 0; phase < 4; phase++) {
    const from = organizingLayouts[phase], to = organizingLayouts[(phase + 1) % organizingLayouts.length]
    for (let sample = 0; sample <= 100; sample++) {
      const fraction = sample / 100
      const layout = { leftWidth: from.leftWidth + (to.leftWidth - from.leftWidth) * fraction, topHeight: from.topHeight + (to.topHeight - from.topHeight) * fraction, split: from.split + (to.split - from.split) * fraction }
      const cards = [0, 1, 2, 3].map(index => organizingRect(index, layout))
      for (const card of cards) {
        assert.ok(card.x >= 20 && card.y >= 20)
        assert.ok(card.x + card.width <= organizingCanvas.width - 20 + 0.001)
        assert.ok(card.y + card.height <= organizingCanvas.height - 20 + 0.001)
      }
      for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) {
        const first = cards[a], second = cards[b], gap = organizingCanvas.gap - 0.001
        assert.ok(first.x + first.width + gap <= second.x || second.x + second.width + gap <= first.x || first.y + first.height + gap <= second.y || second.y + second.height + gap <= first.y)
      }
    }
  }
  for (let index = 0; index < 4; index++) {
    const frames = organizingFrames(index)
    assert.deepEqual(frames[0], frames.at(-1))
  }
})

test('added and replacement cards enter only after the original card leaves, then restore for the loop', () => {
  function opacity(kind: string, progress: number) {
    const frames = organizingVisibility(kind)
    const segment = frames.times.findIndex(time => time >= progress)
    if (segment <= 0) return frames.opacity[0]
    const start = frames.times[segment - 1], end = frames.times[segment]
    return frames.opacity[segment - 1] + (frames.opacity[segment] - frames.opacity[segment - 1]) * (progress - start) / (end - start)
  }
  for (const [original, replacement] of [['notes', 'mail'], ['progress', 'resources']]) {
    for (let sample = 0; sample <= 1000; sample++) assert.ok(opacity(original, sample / 1000) === 0 || opacity(replacement, sample / 1000) === 0)
    assert.equal(opacity(original, 0), original === 'notes' ? 0 : 1); assert.equal(opacity(original, 1), original === 'notes' ? 0 : 1)
    assert.equal(opacity(replacement, 0), 0); assert.equal(opacity(replacement, 1), 0)
    assert.equal(opacity(replacement, replacement === 'mail' ? 0.45 : 0.67), 1)
  }
})

test('five-card stage stays within bounds and the sequence includes three through five visible cards', () => {
  const slots: Record<string, number> = { tasks: 0, agenda: 0, calendar: 1, meetings: 1, progress: 2, resources: 2, notes: 3, mail: 3, timer: 4 }
  const counts = new Set<number>()
  let fourCardSamples = 0
  function sample(values: number[], times: number[], t: number) {
    const i = times.findIndex(time => time >= t)
    if (i <= 0) return values[0]
    return values[i - 1] + (values[i] - values[i - 1]) * (t - times[i - 1]) / (times[i] - times[i - 1])
  }
  for (let tick = 0; tick <= 1600; tick++) {
    const time = tick / 1600
    const visible = Object.entries(slots).filter(([kind]) => { const frames = organizingVisibility(kind); return sample(frames.opacity, frames.times, time) > 0.01 })
    counts.add(visible.length)
    if (visible.length === 4) fourCardSamples++
    const rects = visible.map(([kind, slot]) => {
      const frames = organizingFrames(slot, kind)
      return Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, sample(frames.map(frame => frame[key as keyof typeof frame]), organizingTimes, time)]))
    })
    for (const rect of rects) { assert.ok(rect.x >= 20); assert.ok(rect.y + rect.height <= 440.001) }
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
      const x = rects[a], y = rects[b], gap = 19.999
      assert.ok(x.x + x.width + gap <= y.x || y.x + y.width + gap <= x.x || x.y + x.height + gap <= y.y || y.y + y.height + gap <= x.y)
    }
  }
  assert.deepEqual([...counts].sort(), [3, 4, 5])
  assert.ok(fourCardSamples / 1601 < 0.5)
})

test('top replacements exchange positions using a clear lower-row detour', () => {
  const at = (kind: string, slot: number, second: number) => organizingFrames(slot, kind)[organizingSteps.indexOf(second)]
  assert.equal(at('agenda', 0, 12.5).x, 20); assert.equal(at('meetings', 1, 12.5).x, 390)
  assert.equal(at('agenda', 0, 12.9).y, 180); assert.equal(at('meetings', 1, 12.9).y, 64)
  assert.equal(at('agenda', 0, 13.3).x, 390); assert.equal(at('meetings', 1, 13.3).x, 20)
  assert.equal(at('agenda', 0, 13.7).y, 64); assert.equal(at('meetings', 1, 13.7).y, 64)
})

test('settled arrangements hold geometry and visibility without slowing movement', () => {
  const holds = organizingSteps.flatMap((step, index) => index > 0 && step === organizingSteps[index - 1] ? [index] : [])
  assert.equal(holds.length, 5)
  for (const index of holds) {
    assert.ok(Math.abs((organizingTimes[index] - organizingTimes[index - 1]) * organizingDuration - 0.65) < 0.0001)
    for (const [kind, slot] of [['tasks', 0], ['calendar', 1], ['agenda', 0], ['meetings', 1], ['timer', 4]] as const) {
      const frames = organizingFrames(slot, kind), visibility = organizingVisibility(kind)
      assert.deepEqual(frames[index], frames[index - 1])
      assert.equal(visibility.opacity[index], visibility.opacity[index - 1])
    }
  }
  assert.equal(organizingDuration, 12.8125)
})


test('starts with three cards, adds a fourth and fifth, then removes a neighbor before expanding', () => {
  const kinds = ['tasks', 'calendar', 'progress', 'notes', 'mail', 'resources', 'agenda', 'meetings', 'timer']
  const countAt = (step: number) => kinds.filter(kind => organizingVisibility(kind).opacity[organizingSteps.indexOf(step)] > 0.01).length
  assert.equal(countAt(0), 3)
  assert.equal(countAt(2.6), 4)
  assert.equal(countAt(5.4), 5)
  assert.equal(countAt(17), 3)
  const progress = organizingFrames(2, 'progress')
  assert.equal(progress[0].width, 700)
  assert.ok(progress[organizingSteps.indexOf(2.2)].width < 700)
  assert.equal(progress.at(-1)?.width, 700)
  assert.equal(organizingVisibility('notes').opacity[organizingSteps.indexOf(15.9)], 0)
})
