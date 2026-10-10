import './App.css'

function App() {
  return (
    <div className="landing-container">
      <div className="bg-glow"></div>
      
      <header className="header">
        <div className="badge">
          <span className="badge-dot"></span>
          HackWave 3.0 • Problem Statement 4
        </div>
      </header>

      <main className="main-content">
        <h1 className="title">
          Intent-to-Interface
          <span className="title-gradient"> Adaptive AI Workspace</span>
        </h1>
        
        <p className="philosophy">
          "Don't make humans adapt to software. Make software adapt to human intent."
        </p>

        <div className="status-card">
          <div className="status-header">
            <span className="pulse-indicator"></span>
            <span className="status-title">Coming Soon</span>
          </div>
          <p className="status-description">
            We are building an intelligent, context-aware workspace that dynamically 
            reorganizes its interface around what you want to achieve — turning natural language 
            into actionable, interactive user experiences.
          </p>
        </div>

        <div className="features-preview">
          <div className="feature-pill">
            <span className="feature-icon">✨</span>
            <span>Natural Language Intent</span>
          </div>
          <div className="feature-pill">
            <span className="feature-icon">⚡</span>
            <span>Dynamic Component Composition</span>
          </div>
          <div className="feature-pill">
            <span className="feature-icon">🎯</span>
            <span>In-Place Actionable Experience</span>
          </div>
          <div className="feature-pill">
            <span className="feature-icon">🔍</span>
            <span>Explainable UI Decisions</span>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>© 2026 HackWave 3.0 • Team Harsh231075 • In Active Development</p>
      </footer>
    </div>
  )
}

export default App
