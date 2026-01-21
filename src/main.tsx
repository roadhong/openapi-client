import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { ApiStoreProvider, apiStore } from './store/ApiStore';
import App from './App';
import Toast from './components/others/Toast';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ApiStoreProvider value={apiStore}>
      <App />
      <Toast />
    </ApiStoreProvider>
  </React.StrictMode>
);
