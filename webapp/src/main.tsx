import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { getWebApp, applyTheme } from './telegram';
import './styles.css';

const webApp = getWebApp();
if (webApp) {
  webApp.ready();
  webApp.expand();
  applyTheme(webApp);
  webApp.onEvent('themeChanged', () => applyTheme(webApp));
}

// Регистрация Service Worker для офлайн-доступа к таймеру и секундомеру
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
