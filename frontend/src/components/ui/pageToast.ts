export const PAGE_TOAST_EVENT = 'ccc:page-toast'

export type PageToastDetail = { message: string; type?: 'success' | 'error' }

export function emitPageToast(message: string, type: PageToastDetail['type'] = 'success') {
  window.dispatchEvent(new CustomEvent(PAGE_TOAST_EVENT, { detail: { message, type } }))
}
