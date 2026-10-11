import { LocalDataGate } from '@/components/feedback/LocalDataGate'
import { useSyncExternalStore } from 'react'
import { browserDatabase } from '@/services'
import { GoogleCalendarProvider } from '@/state/GoogleCalendarProvider'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { DisplayPreferencesProvider } from '@/state/DisplayPreferencesProvider'
import { WorkspaceProvider } from '@/state/WorkspaceProvider'
import { PluginsPage } from '@/pages/PluginsPage'
import { NotesPage } from '@/pages/NotesPage'
import { ResourcesPage } from '@/pages/ResourcesPage'
import { MeetingsPage } from '@/pages/MeetingsPage'
import { AppPage } from '@/pages/AppPage'
import { DynamicWorkspace } from '@/pages/DynamicWorkspace'
import { LandingPage } from '@/pages/LandingPage'
import { PlannerPage } from '@/pages/PlannerPage'
import { ComponentGallery } from '@/pages/ComponentGallery'

function App() {
  const epoch = useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getEpoch, browserDatabase.getEpoch)
  return (
    <LocalDataGate><BrowserRouter>
      <WorkspaceProvider key={epoch}><GoogleCalendarProvider><DisplayPreferencesProvider>
        <Routes>
          <Route path="/landing" element={<LandingPage />} />
          <Route element={<WorkspaceLayout />}>
            <Route path="/" element={<DynamicWorkspace />} />
            <Route path="/insights" element={<Navigate to="/" replace />} />
            <Route path="/plugins" element={<PluginsPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/meetings" element={<MeetingsPage />} />
            <Route path="/calendar" element={<Navigate to="/meetings?view=calendar" replace />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/priorities" element={<Navigate to="/tasks" replace />} />
            <Route path="/:view/:mode?" element={<AppPage />} />
            <Route path="/dev/components" element={<ComponentGallery />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DisplayPreferencesProvider></GoogleCalendarProvider></WorkspaceProvider>
    </BrowserRouter></LocalDataGate>
  )
}

export default App
