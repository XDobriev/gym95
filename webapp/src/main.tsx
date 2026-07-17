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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
