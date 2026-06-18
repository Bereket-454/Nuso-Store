import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            'AIzaSyBoGKiGTQXgAlUcBLDl-5PvfeKEYWUPwK8',
  authDomain:        'nuso-store.firebaseapp.com',
  projectId:         'nuso-store',
  storageBucket:     'nuso-store.firebasestorage.app',
  messagingSenderId: '808702557958',
  appId:             '1:808702557958:web:6d81c7471f093512fb6887',
}

function getApp() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
}

let _messaging = null

export async function getFirebaseMessaging() {
  if (_messaging) return _messaging
  const supported = await isSupported()
  if (!supported) return null
  _messaging = getMessaging(getApp())
  return _messaging
}
