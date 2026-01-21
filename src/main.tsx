import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { ApiStoreProvider, apiStore } from './store/ApiStore';
import App from './App';
import Toast from './components/others/Toast';

console.log('[Main] Starting application');

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

console.log('[Main] Root element found, creating React root');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ApiStoreProvider value={apiStore}>
      <App />
      <Toast />
    </ApiStoreProvider>
  </React.StrictMode>
);

console.log('[Main] React root rendered');
