import { useEffect } from 'react'

export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | Dire` : 'Dire'
    const meta = document.querySelector('meta[name="description"]')
    if (meta && description) {
      meta.setAttribute('content', description)
    }
  }, [title, description])
}
