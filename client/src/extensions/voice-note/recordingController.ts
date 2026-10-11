import type { BrowserDatabase } from '../../services/browserDatabase.ts'
import { validProject } from '../../services/projectOwnership.ts'
import type { ExtensionService } from '../extensionService.ts'
import { MAX_RECORDING_MS, MAX_AUDIO_BYTES } from './schema.ts'
export interface RecordingDraft { projectId: string; blob: Blob; durationMs: number; title: string; text: string; epoch: number }
export interface RecordingState { status: 'idle' | 'requesting' | 'recording' | 'stopping'; draft: RecordingDraft | null; error: string }
export interface RecordingEnvironment { getStream(): Promise<MediaStream>; createRecorder(stream: MediaStream): MediaRecorder; now(): number }
const browserEnvironment: RecordingEnvironment = {
  getStream: () => { if (!globalThis.navigator?.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) return Promise.reject(new Error('Audio recording is unavailable. Use a supported browser on HTTPS or localhost.')); return navigator.mediaDevices.getUserMedia({ audio: true }) },
  createRecorder: stream => { const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type)); return new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 }) },
  now: () => Date.now(),
}
export function createRecordingController(database: BrowserDatabase, extensions: ExtensionService, environment = browserEnvironment) {
  let state: RecordingState = { status: 'idle', draft: null, error: '' }, token = 0, stream: MediaStream | null = null, recorder: MediaRecorder | null = null, deadline: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const set = (patch: Partial<RecordingState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  const release = () => { stream?.getTracks().forEach(track => track.stop()); stream = null; clearTimeout(deadline) }
  const stop = () => {
    if (state.status === 'requesting') { token++; set({ status: 'idle' }); return }
    if (recorder?.state === 'recording') { set({ status: 'stopping' }); recorder.stop(); release() }
  }
  extensions.beforeDisable(id => { if (id === 'voice-note') stop() })
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => state,
    async start(projectId: string) {
      if (!extensions.isEnabled('voice-note')) { set({ error: 'Enable Voice Note first.' }); return }
      if (!validProject(database, projectId)) { set({ error: 'Choose an available project.' }); return }
      if (state.status !== 'idle' || state.draft) { set({ error: 'Save or discard the current recording first.' }); return }
      const epoch = database.getEpoch(), current = ++token
      set({ status: 'requesting', error: '' })
      try {
        const acquired = await environment.getStream()
        if (current !== token || epoch !== database.getEpoch() || !extensions.isEnabled('voice-note')) { acquired.getTracks().forEach(track => track.stop()); return }
        stream = acquired; recorder = environment.createRecorder(acquired)
        const active = recorder, chunks: Blob[] = [], startedAt = environment.now(); let bytes = 0
        active.ondataavailable = event => { if (current !== token || epoch !== database.getEpoch()) return; if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes >= MAX_AUDIO_BYTES) stop() } }
        active.onerror = () => { if(current!==token||epoch!==database.getEpoch())return; set({ error: 'Recording interrupted. Any captured audio will be kept.' }); stop() }
        active.onstop = () => {
          if (current !== token || epoch !== database.getEpoch()) return
          release(); recorder = null
          const blob = new Blob(chunks, { type: active.mimeType || chunks[0]?.type || 'audio/webm' })
          set({ status: 'idle', draft: blob.size ? { projectId, blob, durationMs: Math.min(MAX_RECORDING_MS, Math.max(0, environment.now() - startedAt)), title: '', text: '', epoch } : null, ...(blob.size ? {} : { error: 'No audio was captured. Record again.' }) })
        }
        acquired.getTracks().forEach(track => { track.onended = stop })
        active.start(1000); set({ status: 'recording' }); deadline = setTimeout(stop, MAX_RECORDING_MS)
      } catch (error) { if(current!==token)return; release(); recorder = null; set({ status: 'idle', error: error instanceof Error ? error.message : 'Unable to access the microphone. Check browser permissions.' }) }
    },
    reportError(error:string) { set({error}) },
    stop,
    updateDraft(patch: Partial<Pick<RecordingDraft, 'title' | 'text'>>) { if (state.draft) set({ draft: { ...state.draft, ...patch } }) },
    discard() { if (state.status !== 'idle') return; set({ draft: null, error: '' }) },
    saved(draft: RecordingDraft) { if (state.draft === draft) set({ draft: null, error: '' }) },
    reset() { token++; if (recorder?.state === 'recording') recorder.stop(); release(); recorder = null; set({ status: 'idle', draft: null, error: '' }) },
  }
}
