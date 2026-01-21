import { createContext, useContext } from 'react';
import { ApiStore, apiStore } from './ApiStore';

export const ApiStoreContext = createContext<ApiStore | null>(null);

export const ApiStoreProvider = ApiStoreContext.Provider;

export const useApiStore = () => {
  const store = useContext(ApiStoreContext);
  if (!store) {
    throw new Error('ApiStoreProvider is missing.');
  }
  return store;
};

export { apiStore };
