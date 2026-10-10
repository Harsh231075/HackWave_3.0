import type { BrowserDatabase } from './browserDatabase.ts'
import type { ResourceService } from './contracts.ts'
export function createSearchService(database: BrowserDatabase, resources: ResourceService) {
  return { search(query: string) {
    const text = query.trim().toLowerCase()
    const matches = (values: string[]) => text.length > 0 && values.join(' ').toLowerCase().includes(text)
    const state = database.getState()
    return structuredClone({ tasks: state.tasks.filter(task => matches([task.title, task.description, task.owner])), events: state.events.filter(event => matches([event.title, event.agenda, ...event.participants])), resources: resources.list().filter(resource => matches([resource.title, resource.body, resource.context])) })
  } }
}
