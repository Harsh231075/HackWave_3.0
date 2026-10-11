import metadata from './metadata.json' with { type: 'json' }
import type { ExtensionDefinition } from '../contracts.ts'
export const voiceNoteDefinition: ExtensionDefinition = { iconSvg: metadata.iconSvg, id: 'voice-note', widgetId: 'voice-note', title: 'Voice Note', description: 'Record audio and save it as a note.', aiDescription: 'A user-controlled audio recording form. Select when the user wants to capture a spoken idea. Never activate the microphone or claim to transcribe audio.', supportedBindings: ['workspace'] }
