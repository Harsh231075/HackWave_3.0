import type { UsageObservation, UsageRelease } from '../../client/src/domain/usage.ts'
// Fixed values belong only in repeatable seed fixtures; widgets read editable records.
const northstar = [
  ['2026-10-05', 620, 490], ['2026-10-06', 610, 505], ['2026-10-07', 635, 498],
  ['2026-10-08', 570, 510], ['2026-10-09', 490, 502], ['2026-10-10', 450, 496], ['2026-10-11', 420, 508],
] as const
function observations(rows: ReadonlyArray<readonly [string,number,number]>):UsageObservation[]{return rows.flatMap(([date,mobile,desktop])=>Object.entries({mobile,desktop}).map(([segment,sessions])=>({id:`usage-${date}-${segment}`,date,segment,sessions,source:'synthetic'})))}
export const USAGE_DEMO = {
  usageObservations: observations(northstar),
  usageReleases: [
    { id: 'atlas-mobile-release',   date: '2026-10-08', title: 'Mobile onboarding release', description: 'Onboarding flow update. Investigate alongside usage and error records before drawing a causal conclusion.', segments: ['mobile'], source: 'synthetic' },
    { id: 'launch-desktop-release',   date: '2026-10-09', title: 'Desktop navigation release', description: 'Updated desktop navigation for launch preparation.', segments: ['desktop'], source: 'synthetic' },
  ] satisfies UsageRelease[],
}
