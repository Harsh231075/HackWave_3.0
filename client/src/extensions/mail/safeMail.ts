import DOMPurify from 'dompurify'
export function safeMailHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'hr', 'a'],
    ALLOWED_ATTR: ['href', 'title', 'colspan', 'rowspan'],
    ALLOW_DATA_ATTR: false,
  })
}
export function mailPlainText(html: string) {
  const doc = new DOMParser().parseFromString(safeMailHtml(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n'), 'text/html')
  return doc.body.textContent ?? ''
}
export function mailDocument(html: string) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src \'none\'; form-action \'none\'; base-uri \'none\'"><style>body{font:14px system-ui;overflow-wrap:anywhere;color:#222;background:white}pre{white-space:pre-wrap}table{max-width:100%}blockquote{border-left:2px solid #ddd;margin-left:0;padding-left:12px}</style></head><body>' + safeMailHtml(html) + '</body></html>'
}
