import type { UsageObservation, UsageRelease } from '../../src/domain/usage.ts'
// Fixed values belong only in repeatable seed fixtures; widgets read editable records.
const northstar = [
  ['2026-10-05', 620, 490], ['2026-10-06', 610, 505], ['2026-10-07', 635, 498],
  ['2026-10-08', 570, 510], ['2026-10-09', 490, 502], ['2026-10-10', 450, 496], ['2026-10-11', 420, 508],
] as const
const westbridge = [
  ['2026-10-05', 180, 300], ['2026-10-06', 185, 310], ['2026-10-07', 190, 305],
  ['2026-10-08', 200, 315], ['2026-10-09', 205, 320], ['2026-10-10', 210, 325], ['2026-10-11', 220, 330],
] as const
function observations(clientId: string, projectId: string, rows: ReadonlyArray<readonly [string, number, number]>): UsageObservation[] {
  return rows.flatMap(([date, mobile, desktop]) => Object.entries({ mobile, desktop }).map(([segment, sessions]) => ({ id: `${projectId}-${date}-${segment}`, clientId, projectId, date, segment, sessions, source: 'synthetic' })))
}
export const USAGE_DEMO = {
  usageObservations: [...observations('northstar', 'atlas', northstar), ...observations('westbridge', 'launch', westbridge)],
  usageReleases: [
    { id: 'atlas-mobile-release', clientId: 'northstar', projectId: 'atlas', date: '2026-10-08', title: 'Mobile onboarding release', description: 'Onboarding flow update. Investigate alongside usage and error records before drawing a causal conclusion.', segments: ['mobile'], source: 'synthetic' },
    { id: 'launch-desktop-release', clientId: 'westbridge', projectId: 'launch', date: '2026-10-09', title: 'Desktop navigation release', description: 'Updated desktop navigation for launch preparation.', segments: ['desktop'], source: 'synthetic' },
  ] satisfies UsageRelease[],
}
