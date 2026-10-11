import { Toaster } from 'react-hot-toast'

export function ActionToaster() {
  return <Toaster position="top-right" gutter={8} containerStyle={{ top: 24, right: 24, zIndex: 10000 }} toastOptions={{
    duration: 4000,
    style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 14, fontFamily: 'var(--font-sans)', fontSize: 14, maxWidth: 'min(420px, calc(100vw - 48px))', boxShadow: '0 8px 30px rgba(37,41,54,.12)' },
    success: { style: { background: '#f0fdf4', color: '#14532d', border: '1px solid #bbf7d0', padding: '14px 18px' }, iconTheme: { primary: '#16a34a', secondary: '#fff' } },
    error: { duration: 6000 },
  }} />
}
