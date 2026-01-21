import { createStore, del, get, set } from 'idb-keyval';

const DB_NAME = 'SwaggerStoreDB';
const STORE_NAME = 'persist';
const META_KEY = 'meta';
const SOURCE_PREFIX = 'source:';

const hasIndexedDB = typeof indexedDB !== 'undefined';
const store = hasIndexedDB ? createStore(DB_NAME, STORE_NAME) : null;
const memoryStore = hasIndexedDB ? null : new Map<string, string>();

const serialize = (value: unknown) => JSON.stringify(value);
const deserialize = <T>(raw: string | null): T | null =>
  raw == null ? null : (JSON.parse(raw) as T);

const read = async <T>(key: string): Promise<T | null> => {
  if (memoryStore) {
    return deserialize<T>(memoryStore.get(key) ?? null);
  }
  try {
    const raw = (await get<string>(key, store!)) ?? null;
    return deserialize<T>(raw);
  } catch {
    return null;
  }
};

const write = async (key: string, value: unknown): Promise<void> => {
  const payload = serialize(value);
  if (memoryStore) {
    memoryStore.set(key, payload);
    return;
  }
  await set(key, payload, store!);
};

const remove = async (key: string): Promise<void> => {
  if (memoryStore) {
    memoryStore.delete(key);
    return;
  }
  await del(key, store!);
};

// Meta (global) state
export type MetaState = {
  savedSources: Record<string, { type: 'url' | 'text'; value: string }>;
  selectedSourceKey: string;
  darkMode: boolean;
};

export const loadMeta = async (): Promise<MetaState | null> => {
  return read<MetaState>(META_KEY);
};

export const saveMeta = async (meta: MetaState): Promise<void> => {
  await write(META_KEY, meta);
};

// Per-source state (namespaced keys in single store)
const sourceKey = (key: string) => `${SOURCE_PREFIX}${key}`;

export const loadSource = async <T>(key: string): Promise<T | null> => {
  return read<T>(sourceKey(key));
};

export const saveSource = async <T>(key: string, snapshot: T): Promise<void> => {
  await write(sourceKey(key), snapshot);
};

export const deleteSource = async (key: string): Promise<void> => {
  await remove(sourceKey(key));
};
