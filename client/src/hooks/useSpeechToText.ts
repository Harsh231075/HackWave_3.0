import { useCallback, useEffect, useRef, useState } from 'react'
import { createSpeechSession, type SpeechRecognizerConstructor } from '@/domain/speechToText'

function speechConstructor() {
  if (typeof window === 'undefined') return undefined
  const browser = window as Window & {
    SpeechRecognition?: SpeechRecognizerConstructor
    webkitSpeechRecognition?: SpeechRecognizerConstructor
  }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

export function useSpeechToText({ value, onChange, enabled, maxLength = 4000 }: {
  value: string; onChange: (value: string) => void; enabled: boolean; maxLength?: number
}) {
  const [supported] = useState(() => Boolean(speechConstructor()))
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const session = useRef<ReturnType<typeof createSpeechSession> | null>(null)
  const cancel = useCallback(() => {
    session.current?.cancel(); session.current = null; setListening(false)
  }, [])
  useEffect(() => { if (!enabled) session.current?.cancel() }, [enabled])
  useEffect(() => () => {
    const current = session.current
    session.current = null
    current?.cancel()
  }, [])

  function toggle() {
    if (session.current) { session.current.stop(); return }
    if (!enabled || value.length >= maxLength) return
    const Constructor = speechConstructor()
    if (!Constructor) { setError('Speech input is unavailable in this browser. You can still type your goal.'); return }
    setError('')
    try {
      const next = createSpeechSession({
        recognizer: new Constructor(), initialText: value, language: navigator.language || 'en-IN', maxLength,
        onText: onChange, onError: setError,
        onEnd: () => { if (session.current !== next) return; session.current = null; setListening(false) },
      })
      session.current = next; setListening(true); next.start()
    } catch {
      setError('Could not start the microphone. Check browser permissions and try again.')
      cancel()
    }
  }
  return { supported, listening, error, toggle, cancel }
}
