import { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useApiStore } from '../../store/api/ApiStoreContext';

type SavedSourceEntry = {
  type: string;
};

type HeaderViewProps = {
  selectedSourceKey: string;
  savedSources: Record<string, SavedSourceEntry>;
  isLoadingMetadata: boolean;
  activeServerUrl: string | null;
  darkMode: boolean;
  onOpenInfo: () => void;
  onOpenSource: () => void;
  onRemoveSource: () => void;
  onSelectSource: (key: string) => void;
  onCancelLoad: () => void;
  onOpenServers: () => void;
  onOpenAuthorize: () => void;
  onOpenGlobalHeader: () => void;
  onToggleDarkMode: () => void;
};

const HeaderView = observer(
  ({
    selectedSourceKey,
    savedSources,
    isLoadingMetadata,
    activeServerUrl,
    darkMode,
    onOpenInfo,
    onOpenSource,
    onRemoveSource,
    onSelectSource,
    onCancelLoad,
    onOpenServers,
    onOpenAuthorize,
    onOpenGlobalHeader,
    onToggleDarkMode,
  }: HeaderViewProps) => (
    <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <div className="flex flex-1 items-center gap-3 min-w-[16rem]">
          <h1 className="text-lg font-semibold whitespace-nowrap text-slate-900 dark:text-slate-100">
            OpenAPI Client
          </h1>
          <button
            type="button"
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            onClick={onOpenInfo}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Info
          </button>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300 min-w-0">
            <button
              type="button"
              className="rounded-md bg-slate-800 dark:bg-slate-700 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-900 dark:hover:bg-slate-600 flex items-center gap-2"
              onClick={onOpenSource}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onRemoveSource}
              disabled={!selectedSourceKey}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Remove
            </button>
            <select
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
              value={selectedSourceKey}
              onChange={(event) => onSelectSource(event.target.value)}
            >
              <option value="">Saved sources</option>
              {Object.entries(savedSources).map(([key, entry]) => (
                <option key={key} value={key}>
                  {key} ({entry.type})
                </option>
              ))}
            </select>
            <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              openapi json
              {isLoadingMetadata && (
                <>
                  <svg
                    className="h-3 w-3 animate-spin text-slate-500 dark:text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z"
                    />
                  </svg>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={onCancelLoad}
                    title="Cancel loading"
                  >
                    Cancel
                  </button>
                </>
              )}
            </span>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:ml-auto">
          {activeServerUrl ? (
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Active: {activeServerUrl}
            </span>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            onClick={onOpenServers}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
              />
            </svg>
            Servers
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 flex items-center gap-2"
            onClick={onOpenAuthorize}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Authorize
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2"
            onClick={onOpenGlobalHeader}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            Global Header
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                Light
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
                Dark
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  )
);

const Header = observer(() => {
  const store = useApiStore();

  const handleOpenInfo = useCallback(
    () => store.setInfoDialogOpen(true),
    [store]
  );
  const handleOpenSource = useCallback(
    () => store.setSourceDialogOpen(true),
    [store]
  );
  const handleRemoveSource = useCallback(
    () => store.removeSavedSource(store.selectedSourceKey),
    [store]
  );
  const handleSelectSource = useCallback(
    (key: string) => store.loadSavedSource(key),
    [store]
  );
  const handleCancelLoad = useCallback(
    () => store.cancelLoadMetadata(),
    [store]
  );
  const handleOpenServers = useCallback(
    () => store.setServerDialogOpen(true),
    [store]
  );
  const handleOpenAuthorize = useCallback(
    () => store.setGlobalAuthDialogOpen(true),
    [store]
  );
  const handleOpenGlobalHeader = useCallback(
    () => store.setHeaderDialogOpen(true),
    [store]
  );
  const handleToggleDarkMode = useCallback(
    () => store.toggleDarkMode(),
    [store]
  );

  return (
    <HeaderView
      selectedSourceKey={store.selectedSourceKey}
      savedSources={store.savedSources}
      isLoadingMetadata={store.isLoadingMetadata}
      activeServerUrl={store.activeServerUrl ?? null}
      darkMode={store.darkMode}
      onOpenInfo={handleOpenInfo}
      onOpenSource={handleOpenSource}
      onRemoveSource={handleRemoveSource}
      onSelectSource={handleSelectSource}
      onCancelLoad={handleCancelLoad}
      onOpenServers={handleOpenServers}
      onOpenAuthorize={handleOpenAuthorize}
      onOpenGlobalHeader={handleOpenGlobalHeader}
      onToggleDarkMode={handleToggleDarkMode}
    />
  );
});

export default Header;
