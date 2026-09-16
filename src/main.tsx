import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getInitialLanguage, setLanguage } from './i18n';

// Apply the saved/browser language before React renders so localized values such as currency are correct on first paint.
setLanguage(getInitialLanguage());

// Register service worker for offline support and APK performance
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

