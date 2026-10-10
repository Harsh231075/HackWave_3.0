import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export function LandingPage() {
  return <main className="minimal-about"><h1>GoGPT</h1><p>A workspace shaped by your goal.</p><Link to="/">Open workspace <ArrowRight size={16} /></Link></main>
}
