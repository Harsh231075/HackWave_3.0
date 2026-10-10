import { BrowserRouter, Route, Routes } from 'react-router'
import { WorkspaceProvider } from '@/state/WorkspaceProvider'
import { AppPage } from '@/pages/AppPage'
import { LandingPage } from '@/pages/LandingPage'
import { ComponentGallery } from '@/pages/ComponentGallery'

function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Routes>
          <Route path="/" element={<AppPage />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/dev/components" element={<ComponentGallery />} />
          <Route path="*" element={<AppPage />} />
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  )
}

export default App
