import { useSyncExternalStore } from 'react'
import { browserDatabase, projectDataService } from '@/services'
export function useProject() {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const selectedId = projectDataService.selectedId()
  return { selectedId, projects: projectDataService.projects.list(), project: selectedId ? projectDataService.projects.getById(selectedId) : null, compatible: projectDataService.compatible() }
}
