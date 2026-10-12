import type { CanvasMetrics } from '@/domain/widgetLayout'
export function measureCanvas(element: HTMLElement | null): CanvasMetrics {
  const rect = element?.getBoundingClientRect()
  const styles = element ? getComputedStyle(element) : null
  return {
    width: Math.max(0, (rect?.width ?? window.innerWidth) - (parseFloat(styles?.paddingLeft ?? '0') || 0) - (parseFloat(styles?.paddingRight ?? '0') || 0)),
    height: Math.max(0, window.innerHeight - Math.max(0, rect?.top ?? 0)),
    gap: window.innerWidth <= 900 ? 16 : 24, allowVerticalScroll: true,
  }
}
