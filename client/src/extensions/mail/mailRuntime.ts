import { mailPlainText } from './safeMail.ts'
import { createMailService } from './mailService.ts'
import { loadMailIdentity, requestMailToken } from './googleIdentity.ts'

export const mailService = createMailService({
  prepare: loadMailIdentity,
  htmlToText: mailPlainText,
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  authorize: async (clientId, hint) => requestMailToken(await loadMailIdentity(), clientId, hint),
  revoke: async token => new Promise<void>((resolve, reject) => {
    void loadMailIdentity().then(api => api.revoke(token, result => result.successful ? resolve() : reject(new Error('Google could not revoke Mail access. Try again or use your Google account permissions.')))).catch(reject)
  }),
})
