import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { WorkspaceProvider } from '@/state/WorkspaceProvider'
import { AppPage } from '@/pages/AppPage'
import { LandingPage } from '@/pages/LandingPage'
import { ComponentGallery } from '@/pages/ComponentGallery'

function App() {
  return <BrowserRouter><WorkspaceProvider><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/app" element={<AppPage />} />
    {import.meta.env.DEV && <Route path="/dev/components" element={<ComponentGallery />} />}
    <Route path="*" element={<main className="not-found"><h1>This space doesn’t exist yet.</h1><p>Find your tasks and plans in the workspace.</p><Link to="/app">Go to workspace →</Link></main>} />
  </Routes></WorkspaceProvider></BrowserRouter>
}

export default App
