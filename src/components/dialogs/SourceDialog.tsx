import { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useApiStore } from '../../store/api/ApiStoreContext';

type SourceType = 'url' | 'text';

type SourceDialogViewProps = {
  open: boolean;
  sourceKey: string;
  sourceType: SourceType;
  sourceValue: string;
  isLoading: boolean;
  onKeyChange: (key: string) => void;
  onTypeChange: (type: SourceType) => void;
  onValueChange: (value: string) => void;
  onTestConnect: () => void;
  onAdd: () => void;
  onClose: () => void;
};

const SourceDialogView = observer(
  ({
    open,
    sourceKey,
    sourceType,
    sourceValue,
    isLoading,
    onKeyChange,
    onTypeChange,
    onValueChange,
    onTestConnect,
    onAdd,
    onClose,
  }: SourceDialogViewProps) => {
    if (!open) {
      return null;
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-800 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Add Source
            </p>
            <button
              type="button"
              className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                placeholder="Key"
                value={sourceKey}
                onChange={(event) => onKeyChange(event.target.value)}
              />
              <select
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm text-slate-700 dark:text-slate-200"
                value={sourceType}
                onChange={(event) =>
                  onTypeChange(event.target.value as SourceType)
                }
              >
                <option value="url">URL</option>
                <option value="text">JSON/YAML</option>
              </select>
            </div>
            {sourceType === 'url' ? (
              <input
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                placeholder="https://..."
                value={sourceValue}
                onChange={(event) => onValueChange(event.target.value)}
              />
            ) : (
              <div className="space-y-2">
                <textarea
                  className="h-80 w-full resize-y rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                  placeholder="OpenAPI JSON/YAML"
                  value={sourceValue}
                  onChange={(event) => onValueChange(event.target.value)}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                onClick={onTestConnect}
                disabled={isLoading}
              >
                Test Connect
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 dark:bg-blue-700 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
                onClick={onAdd}
                disabled={isLoading}
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

const SourceDialog = observer(() => {
  const store = useApiStore();

  const handleKeyChange = useCallback(
    (key: string) => store.setSourceDraftKey(key),
    [store]
  );
  const handleTypeChange = useCallback(
    (type: SourceType) => store.setSourceDraftType(type),
    [store]
  );
  const handleValueChange = useCallback(
    (value: string) => store.setSourceDraftValue(value),
    [store]
  );
  const handleTestConnect = useCallback(() => store.testConnect(), [store]);
  const handleAdd = useCallback(
    async () => await store.addSavedSource(),
    [store]
  );
  const handleClose = useCallback(
    () => store.setSourceDialogOpen(false),
    [store]
  );

  return (
    <SourceDialogView
      open={store.sourceDialogOpen}
      sourceKey={store.sourceDraftKey}
      sourceType={store.sourceDraftType}
      sourceValue={store.sourceDraftValue}
      isLoading={store.isLoadingMetadata}
      onKeyChange={handleKeyChange}
      onTypeChange={handleTypeChange}
      onValueChange={handleValueChange}
      onTestConnect={handleTestConnect}
      onAdd={handleAdd}
      onClose={handleClose}
    />
  );
});

export default SourceDialog;
