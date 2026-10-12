import { createAuthClient } from 'better-auth/react'

// Relative URLs keep development and Docker cookie authentication on the same origin.
export const authClient = createAuthClient()
