import { AppRouter } from './app/router'
import { InstallBanner } from './components/InstallBanner'
import { PushPermissionPrompt } from './components/PushPermissionPrompt'

function App() {
  return (
    <>
      <AppRouter />
      <InstallBanner />
      <PushPermissionPrompt />
    </>
  )
}

export default App
