import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Paperclip } from 'lucide-react'
import { fileService, resourceModuleService } from '@/services'
import { Button } from '@/components/ui/button'
export function AttachmentManager() {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  return <><input ref={input} type="file" className="sr-only" aria-label="Upload attachment" disabled={pending} onChange={async event => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || pending) return
    setPending(true)
    let fileId: string | undefined
    try {
      const uploaded = await fileService.upload(file, file.name)
      if (!uploaded.ok) throw new Error(uploaded.message)
      fileId = uploaded.value.id
      const saved = await resourceModuleService.save({ title: file.name, kind: 'attachment', context: '', body: 'file:' + fileId, description: '', tags: [], links: [] })
      if (!saved.ok) { await fileService.delete(fileId); throw new Error(saved.message) }
      toast.success('Attachment saved')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Upload failed.') }
    finally { setPending(false) }
  }}/><Button size="sm" variant="outline" disabled={pending} onClick={() => input.current?.click()}><Paperclip size={14}/>{pending ? 'Uploading…' : 'Attach file'}</Button></>
}
