import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSpeechSession, speechErrorMessage, type SpeechRecognizer, type SpeechResultEvent } from '../src/domain/speechToText.ts'

function setup(initialText = '', maxLength = 4000) {
  let starts = 0, stops = 0, aborts = 0, ends = 0
  const texts: string[] = [], errors: string[] = []
  const recognizer: SpeechRecognizer = {
    lang: '', continuous: false, interimResults: false,
    onresult: null, onerror: null, onend: null,
    start() { starts++ }, stop() { stops++ }, abort() { aborts++ },
  }
  const session = createSpeechSession({ recognizer, initialText, language: 'en-IN', maxLength,
    onText: text => texts.push(text), onError: error => errors.push(error), onEnd: () => ends++,
  })
  const result = (...transcripts: string[]) => recognizer.onresult?.({ results: transcripts.map(transcript => [{ transcript }]) })
  return { recognizer, session, result, texts, errors, counts: () => ({ starts, stops, aborts, ends }) }
}
test('speech starts only on request and enables live results', () => {
  const s = setup()
  assert.equal(s.counts().starts, 0)
  assert.equal(s.recognizer.lang, 'en-IN')
  assert.equal(s.recognizer.continuous, true)
  assert.equal(s.recognizer.interimResults, true)
  s.session.start()
  assert.equal(s.counts().starts, 1)
})
test('interim and cumulative results replace text without repeating words', () => {
  const s = setup('Please')
  s.result('show')
  s.result('show my tasks')
  s.result('show my tasks', 'and calendar')
  assert.deepEqual(s.texts, ['Please show', 'Please show my tasks', 'Please show my tasks and calendar'])
})
test('blank input has no leading space and empty results preserve existing text', () => {
  const s = setup()
  s.result('   ')
  assert.deepEqual(s.texts, [])
  s.result('  Plan my day  ')
  assert.deepEqual(s.texts, ['Plan my day'])
})
test('speech respects the goal character limit', () => {
  const s = setup('Goal', 12)
  s.result('plus a long sentence')
  assert.equal(s.texts[0], 'Goal plus a ')
  assert.equal(s.texts[0].length, 12)
})
test('stop accepts the final result before ending', () => {
  const s = setup()
  s.session.start(); s.result('Plan my'); s.session.stop()
  assert.equal(s.counts().stops, 1)
  s.result('Plan my day'); s.recognizer.onend?.()
  assert.equal(s.texts.at(-1), 'Plan my day')
  assert.equal(s.counts().ends, 1)
  assert.equal(s.recognizer.onresult, null)
})
test('cancel aborts the microphone and ignores late events after typing or closing', () => {
  const s = setup('Typed text')
  const lateResult = s.recognizer.onresult
  s.session.start(); s.session.cancel(); s.session.cancel()
  lateResult?.({ results: [[{ transcript: 'stale speech' }]] } as SpeechResultEvent)
  assert.equal(s.counts().aborts, 1)
  assert.deepEqual(s.texts, [])
  assert.equal(s.recognizer.onresult, null)
  assert.equal(s.recognizer.onerror, null)
  assert.equal(s.recognizer.onend, null)
})
test('microphone denial ends listening with an actionable error', () => {
  const s = setup()
  s.recognizer.onerror?.({ error: 'not-allowed' })
  assert.match(s.errors[0], /site settings/)
  assert.equal(s.counts().ends, 1)
  assert.equal(s.counts().aborts, 1)
})
test('a start failure reports an error and releases the session', () => {
  const s = setup()
  s.recognizer.start = () => { throw new Error('start failed') }
  s.session.start()
  assert.match(s.errors[0], /Could not start/)
  assert.equal(s.counts().ends, 1)
  assert.equal(s.recognizer.onresult, null)
})
test('a stop failure also releases recognition', () => {
  const s = setup()
  s.recognizer.stop = () => { throw new Error('already stopped') }
  s.session.stop()
  assert.equal(s.counts().ends, 1)
  assert.equal(s.counts().aborts, 1)
})
test('expected abort does not show a permission or network error', () => {
  const s = setup()
  s.recognizer.onerror?.({ error: 'aborted' })
  assert.deepEqual(s.errors, [])
  assert.equal(s.counts().ends, 1)
})
test('no-speech, missing microphone and network failures have useful messages', () => {
  assert.match(speechErrorMessage('no-speech'), /No speech/)
  assert.match(speechErrorMessage('audio-capture'), /No microphone/)
  assert.match(speechErrorMessage('network'), /connection/)
  assert.match(speechErrorMessage('language-not-supported'), /language/)
})
