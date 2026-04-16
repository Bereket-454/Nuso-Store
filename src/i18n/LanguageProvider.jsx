import { useCallback, useEffect, useMemo, useState } from 'react'
import { interpolate, resolveTranslation } from './translations'
import { LanguageContext } from './languageContext'

const STORAGE_KEY = 'dire-language'

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'en' || stored === 'am') return stored
    } catch {
      /* ignore */
    }
    return 'en'
  })

  const setLanguage = useCallback((lang) => {
    if (lang !== 'en' && lang !== 'am') return
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language === 'am' ? 'am' : 'en'
    document.documentElement.classList.toggle('lang-am', language === 'am')
  }, [language])

  const t = useCallback(
    (path, vars) => {
      const raw = resolveTranslation(language, path)
      return vars ? interpolate(raw, vars) : raw
    },
    [language],
  )

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
