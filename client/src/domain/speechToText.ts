// Minimal browser API types keep speech recognition optional across browsers.
export interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
export interface SpeechRecognizer {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
export type SpeechRecognizerConstructor = new () => SpeechRecognizer

export function speechErrorMessage(error: string) {
  switch (error) {
    case 'not-allowed': case 'service-not-allowed':
      return 'Microphone access was denied. Allow it in your browser’s site settings, then try again.'
    case 'audio-capture': return 'No microphone is available. Connect one and try again.'
    case 'no-speech': return 'No speech was detected. Tap the microphone and try again.'
    case 'network': return 'Speech recognition could not connect. Check your connection or type your goal.'
    case 'language-not-supported': return 'Your browser’s speech language is unavailable. You can type your goal instead.'
    default: return 'Speech recognition stopped. Try again or type your goal.'
  }
}

export function createSpeechSession({ recognizer, initialText, language, maxLength = 4000, onText, onError, onEnd }: {
  recognizer: SpeechRecognizer; initialText: string; language: string; maxLength?: number
  onText: (text: string) => void; onError: (message: string) => void; onEnd: () => void
}) {
  let active = true
  const detach = () => { recognizer.onresult = null; recognizer.onerror = null; recognizer.onend = null }
  const end = () => { if (!active) return; active = false; detach(); onEnd() }
  const cancel = () => {
    if (!active) return
    active = false; detach()
    try { recognizer.abort() } catch { /* Some engines have already ended. */ }
    onEnd()
  }
  recognizer.lang = language
  recognizer.continuous = true
  recognizer.interimResults = true
  recognizer.onresult = event => {
    if (!active) return
    // Results are cumulative: replace interim words instead of appending them again.
    const transcript = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim()
    if (!transcript) return
    const prefix = initialText.trimEnd()
    onText(`${prefix}${prefix ? ' ' : ''}${transcript}`.slice(0, maxLength))
  }
  recognizer.onerror = event => {
    if (!active) return
    if (event.error !== 'aborted') onError(speechErrorMessage(event.error))
    end()
    try { recognizer.abort() } catch { /* Recognition may already be stopped. */ }
  }
  recognizer.onend = end
  return {
    start() {
      try { recognizer.start() } catch {
        onError('Could not start the microphone. Check browser permissions and try again.')
        cancel()
      }
    },
    stop() {
      if (!active) return
      try { recognizer.stop() } catch { cancel() }
    },
    cancel,
  }
}
