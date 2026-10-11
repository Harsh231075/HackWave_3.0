import type { NoteSnapshot } from '../../services/noteService.ts'
import type { BrowserDatabase } from '../../services/browserDatabase.ts'
import { createCollection } from '../../services/local/collection.ts'
import { createNoteService } from '../../services/noteService.ts'
import { voiceNoteSchema, MAX_AUDIO_BYTES, MAX_RECORDING_MS } from './schema.ts'
import type { AudioStorage } from './audioStorage.ts'
export function createVoiceNoteService(database: BrowserDatabase, audio: AudioStorage) {
  const records = createCollection(database, 'voiceNotes', voiceNoteSchema), notes = createNoteService(database)
  return {
    list: () => records.list(),
    forNote: (noteId: string) => records.list().find(record => record.noteId === noteId),
    getAudio: (id: string) => audio.get(id),
    async save(blob: Blob, durationMs: number, title: string, text: string) {
      if (!blob.size || blob.size > MAX_AUDIO_BYTES || durationMs < 0 || !Number.isFinite(durationMs) || durationMs > MAX_RECORDING_MS || !blob.type.startsWith('audio/'))return {ok:false as const,message:'Choose an audio recording up to two minutes / 5 MB.'}
      const epoch = database.getEpoch(), id = crypto.randomUUID()
      try {
        await audio.put(id, blob)
        if (epoch !== database.getEpoch()) { await audio.delete(id); return { ok: false as const, message: 'Local data changed. This recording was not saved.' } }
        const result = database.transaction(() => {
          const note = notes.create({ title: title.trim() || 'Voice note', body: text })
          if (!note.ok) return note
          return records.save({ id,  noteId: note.value.id, audioId: id, durationMs, mimeType: blob.type, size: blob.size, createdAt: new Date().toISOString() })
        })
        if (!result.ok) await audio.delete(id)
        return result
      } catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : 'Unable to save audio. Retry or download your recording.' } }
    },
    async deleteNote(noteId:string,expected:NoteSnapshot){
      const record=records.list().find(r=>r.noteId===noteId)
      const result=database.transaction(()=>{if(record){const removed=records.delete(record.id);if(!removed.ok)return removed}return notes.delete(noteId,expected)})
      if(result.ok&&record){try{await audio.delete(record.audioId)}catch(error){return {ok:true as const,value:undefined,warning:error instanceof Error?error.message:'Audio cleanup failed. Reset local data to retry.'}}}
      return result
    },
    clearAudio: () => audio.clear(),
  }
}
