import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { WorkspaceProvider } from '@/state/WorkspaceProvider'
import { AppPage } from '@/pages/AppPage'
import { DynamicWorkspace } from '@/pages/DynamicWorkspace'
import { LandingPage } from '@/pages/LandingPage'
import { ComponentGallery } from '@/pages/ComponentGallery'

function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route element={<WorkspaceLayout />}>
          <Route path="/app" element={<DynamicWorkspace />} />
          <Route path="/app/insights" element={<Navigate to="/app" replace />} />
          <Route path="/app/:view/:mode?" element={<AppPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/dev/components" element={<ComponentGallery />} />
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  )
}

export default App
