// Shared cuts keep every card separated throughout interpolation, not just at rest.
export const organizingCanvas = { width: 760, height: 460, gap: 20, left: 20, top: 64 }
export const organizingLayouts = [
  { leftWidth: 432, topHeight: 216, split: 0 },
  { leftWidth: 300, topHeight: 140, split: 0 },
  { leftWidth: 350, topHeight: 178, split: 0 },
  { leftWidth: 350, topHeight: 96, split: 1 },
  { leftWidth: 350, topHeight: 212, split: 1, lane: true },
  { leftWidth: 300, topHeight: 116, split: 1 },
  { leftWidth: 400, topHeight: 96, split: 1 },
] as const
const movementDuration = 9 * 17 / 16
const pauseDuration = 0.65
const pauseSteps = new Set([2.2, 4.8, 6.4, 8.5, 13.7])
export const organizingDuration = movementDuration + pauseSteps.size * pauseDuration
const frameTimes = [0, 2.2, 4.8, 6.4, 8.5, 9, 12.5, 12.9, 13.3, 13.7, 14.5, 15.2, 16.3, 17]
const movementCuts = [0, 0.6, 0.9, 2.2, 2.3, 2.6, 2.9, 3.1, 3.4, 3.7, 3.9, 4.2, 4.4, 4.7, 4.8, 5, 5.1, 5.3, 5.4, 6.4, 6.5, 6.8, 7, 7.3, 7.5, 7.8, 8, 8.3, 8.5, 9, 9.2, 9.5, 10, 10.3, 10.5, 10.8, 11.5, 11.8, 12, 12.1, 12.3, 12.5, 12.9, 13.3, 13.7, 14, 14.1, 14.12, 14.3, 14.4, 14.5, 14.6, 14.8, 14.9, 14.92, 15.05, 15.1, 15.15, 15.2, 15.4, 15.42, 15.65, 15.7, 15.9, 16.3, 17]
// Duplicate settled frames on a shared clock so geometry and replacements pause together.
let elapsedPause = 0
const clock = movementCuts.flatMap(step => {
  const elapsed = step / 17 * movementDuration + elapsedPause
  if (!pauseSteps.has(step)) return [{ step, elapsed }]
  elapsedPause += pauseDuration
  return [{ step, elapsed }, { step, elapsed: elapsed + pauseDuration }]
})
export const organizingSteps = clock.map(frame => frame.step)
const timeline = organizingSteps
export const organizingTimes = clock.map(frame => frame.elapsed / organizingDuration)
function interpolate(values: number[], times: number[], time: number) {
  const index = times.findIndex(value => value >= time)
  if (index <= 0) return values[0]
  const fraction = (time - times[index - 1]) / (times[index] - times[index - 1])
  return values[index - 1] + (values[index] - values[index - 1]) * fraction
}
export function organizingRect(index: number, layout: { leftWidth: number; topHeight: number; split?: number; lane?: boolean }) {
  const right = index % 2 === 1 || index === 4, bottom = index >= 2
  const bottomHeight = 356 - layout.topHeight
  const upperHeight = bottomHeight - (layout.split ?? 0) * (bottomHeight + 20) / 2
  return {
    x: right ? 40 + layout.leftWidth : 20,
    y: bottom ? 84 + layout.topHeight + (index === 4 ? upperHeight + 20 : 0) : 64,
    width: right ? 700 - layout.leftWidth : layout.leftWidth,
    height: index === 4 ? (bottomHeight - 20) / 2 : index === 3 ? upperHeight : bottom ? bottomHeight : layout.lane ? 96 : layout.topHeight,
  }
}
export function organizingFrames(index: number, kind?: string) {
  const positions = [0, 0, 3, 5, 6, 6, 4, 4, 4, 4, 4, 0, 0, 0].map((layout, frame) => {
    const swapping = frame >= 8
    const slot = swapping && kind === 'agenda' ? 1 : swapping && kind === 'meetings' ? 0 : index
    const rect = organizingRect(slot, organizingLayouts[layout])
    // Agenda uses the vacant lower row while Meetings crosses the upper row.
    if (kind === 'agenda' && (frame === 7 || frame === 8)) rect.y = 180
    // Begin and finish with one full-width lower card; make room before adding its neighbor.
    if (index === 2 && (frame === 0 || frame >= 13)) rect.width = 700
    return rect
  })
  return timeline.map(time => ({
    x: interpolate(positions.map(rect => rect.x), frameTimes, time),
    y: interpolate(positions.map(rect => rect.y), frameTimes, time),
    width: interpolate(positions.map(rect => rect.width), frameTimes, time),
    height: interpolate(positions.map(rect => rect.height), frameTimes, time),
  }))
}
// Separate fade windows leave a visible gap before another card occupies the same slot.
export function organizingVisibility(kind: string) {
  const windows: Record<string, number[][]> = {
    tasks: [[0, 1], [3.9, 1], [4.2, 0], [15.42, 0], [15.65, 1], [17, 1]],
    calendar: [[0, 1], [6.5, 1], [6.8, 0], [14.92, 0], [15.15, 1], [17, 1]],
    notes: [[0, 0], [2.3, 0], [2.6, 1], [2.9, 1], [3.1, 0], [10.5, 0], [10.8, 1], [15.7, 1], [15.9, 0], [17, 0]],
    progress: [[0, 1], [7.5, 1], [7.8, 0], [12.1, 0], [12.3, 1], [17, 1]],
    mail: [[0, 0], [3.4, 0], [3.7, 1], [10, 1], [10.3, 0], [17, 0]],
    resources: [[0, 0], [8, 0], [8.3, 1], [11.8, 1], [12, 0], [17, 0]],
    agenda: [[0, 0], [4.4, 0], [4.7, 1], [14.6, 1], [14.9, 0], [17, 0]],
    meetings: [[0, 0], [7, 0], [7.3, 1], [15.2, 1], [15.4, 0], [17, 0]],
    timer: [[0, 0], [5.1, 0], [5.4, 1], [14, 1], [14.3, 0], [17, 0]],
  }
  const frames = windows[kind] ?? [[0, 1], [17, 1]]
  return { opacity: timeline.map(time => interpolate(frames.map(frame => frame[1]), frames.map(frame => frame[0]), time)), times: organizingTimes }
}
