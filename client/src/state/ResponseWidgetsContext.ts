import { createContext, useContext } from 'react'
// The working layout retains context; each chat response displays only its own requested tools.
export const ResponseWidgetsContext = createContext<readonly string[] | null>(null)
export const useResponseWidgets = () => useContext(ResponseWidgetsContext)
