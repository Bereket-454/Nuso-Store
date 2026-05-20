import { useEffect, useRef, useState } from 'react'

export function InstallBanner() {
  const promptRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // User previously dismissed
    if (localStorage.getItem('pwaInstallDismissed')) return

    const handler = (e) => {
      e.preventDefault()
      promptRef.current = e
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Show after 30 s only if the browser supplied a prompt
    const timer = setTimeout(() => {
      if (promptRef.current) setVisible(true)
    }, 30000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
  }, [])

  if (!visible) return null

  const handleInstall = async () => {
    if (!promptRef.current) return
    promptRef.current.prompt()
    await promptRef.current.userChoice
    localStorage.setItem('pwaInstallDismissed', '1')
    setVisible(false)
    promptRef.current = null
  }

  const handleDismiss = () => {
    localStorage.setItem('pwaInstallDismissed', '1')
    setVisible(false)
  }

  return (
    <div className="install-banner" role="complementary" aria-label="Install app">
      <p className="install-banner__text">Install Nuso Store for faster access</p>
      <div className="install-banner__actions">
        <button type="button" className="install-banner__install" onClick={handleInstall}>
          Install
        </button>
        <button type="button" className="install-banner__dismiss" onClick={handleDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
