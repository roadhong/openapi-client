import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { HeaderMappingRule } from '../../types';
import { useApiStore } from '../../store/api/ApiStoreContext';

type HeaderRow = { id: string; key: string; value: string };
type MappingRow = HeaderMappingRule & { id: string };

type HeaderDialogViewProps = {
  open: boolean;
  rows: HeaderRow[];
  mappingRows: MappingRow[];
  onAddRow: () => void;
  onUpdateRow: (index: number, next: HeaderRow) => void;
  onRemoveRow: (index: number) => void;
  onAddMappingRow: () => void;
  onUpdateMappingRow: (index: number, next: MappingRow) => void;
  onRemoveMappingRow: (index: number) => void;
  onClose: () => void;
};

const buildHeaderObject = (nextRows: HeaderRow[]) =>
  nextRows.reduce<Record<string, string>>((acc, row) => {
    const trimmedKey = row.key.trim();
    if (!trimmedKey) {
      return acc;
    }
    acc[trimmedKey] = row.value;
    return acc;
  }, {});

const buildMappingDraft = (nextRows: MappingRow[]) =>
  nextRows.map((row) => ({
    path: row.path.trim(),
    responsePath: row.responsePath.trim(),
    variable: row.variable.trim(),
  }));

const HeaderDialogView = observer(
  ({
    open,
    rows,
    mappingRows,
    onAddRow,
    onUpdateRow,
    onRemoveRow,
    onAddMappingRow,
    onUpdateMappingRow,
    onRemoveMappingRow,
    onClose,
  }: HeaderDialogViewProps) => {
    if (!open) {
      return null;
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl rounded-xl bg-white dark:bg-slate-800 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Global Header
            </p>
          </div>
          <div className="space-y-3 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                <span>Headers</span>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={onAddRow}
                >
                  +
                </button>
              </div>
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      className="w-40 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                      placeholder="Key"
                      value={row.key}
                      onChange={(event) => {
                        onUpdateRow(index, { ...row, key: event.target.value });
                      }}
                    />
                    <input
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                      placeholder="Value"
                      value={row.value}
                      onChange={(event) => {
                        onUpdateRow(index, { ...row, value: event.target.value });
                      }}
                    />
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => onRemoveRow(index)}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-300">
                Example: Authorization: Bearer {'{{'}token{'}}'} / Multiple
                variables: {'{{'}
                token|accessToken{'}}'}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                <span>Mapping Rules</span>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={onAddMappingRow}
                >
                  +
                </button>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-300">
                Path example: /auth/login, /users/{'{id}'}
              </p>
              <div className="space-y-2">
                {mappingRows.map((row, index) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      className="w-40 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                      placeholder="Path"
                      value={row.path}
                      onChange={(event) => {
                        onUpdateMappingRow(index, {
                          ...row,
                          path: event.target.value,
                        });
                      }}
                    />
                    <input
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                      placeholder="Response path (e.g. data.token)"
                      value={row.responsePath}
                      onChange={(event) => {
                        onUpdateMappingRow(index, {
                          ...row,
                          responsePath: event.target.value,
                        });
                      }}
                    />
                    <input
                      className="w-40 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                      placeholder="Variable"
                      value={row.variable}
                      onChange={(event) => {
                        onUpdateMappingRow(index, {
                          ...row,
                          variable: event.target.value,
                        });
                      }}
                    />
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => onRemoveMappingRow(index)}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

const HeaderDialog = observer(() => {
  const store = useApiStore();
  const nextRowId = useRef(0);
  const createRowId = () => `row-${(nextRowId.current += 1)}`;

  const [rows, setRows] = useState<HeaderRow[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);

  useEffect(() => {
    if (!store.headerDialogOpen) {
      return;
    }
    const entries = Object.entries(store.headerDraft ?? {}).map(
      ([key, value]) => ({
        id: createRowId(),
        key,
        value,
      })
    );
    setRows(
      entries.length > 0 ? entries : [{ id: createRowId(), key: '', value: '' }]
    );
    setMappingRows(
      store.headerMappingDraft.length > 0
        ? store.headerMappingDraft.map((row) => ({ ...row, id: createRowId() }))
        : [{ id: createRowId(), path: '', responsePath: '', variable: '' }]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.headerDialogOpen]);

  const syncHeaderDraft = (nextRows: HeaderRow[]) => {
    setRows(nextRows);
    store.setHeaderDraft(buildHeaderObject(nextRows));
  };

  const syncMappingDraft = (nextRows: MappingRow[]) => {
    setMappingRows(nextRows);
    store.setHeaderMappingDraft(buildMappingDraft(nextRows));
  };

  return (
    <HeaderDialogView
      open={store.headerDialogOpen}
      rows={rows}
      mappingRows={mappingRows}
      onAddRow={() =>
        syncHeaderDraft([...rows, { id: createRowId(), key: '', value: '' }])
      }
      onUpdateRow={(index, next) =>
        syncHeaderDraft(rows.map((row, idx) => (idx === index ? next : row)))
      }
      onRemoveRow={(index) => {
        const nextRows = rows.filter((_, idx) => idx !== index);
        const safeRows =
          nextRows.length > 0
            ? nextRows
            : [{ id: createRowId(), key: '', value: '' }];
        syncHeaderDraft(safeRows);
      }}
      onAddMappingRow={() =>
        syncMappingDraft([
          ...mappingRows,
          { id: createRowId(), path: '', responsePath: '', variable: '' },
        ])
      }
      onUpdateMappingRow={(index, next) =>
        syncMappingDraft(
          mappingRows.map((row, idx) => (idx === index ? next : row))
        )
      }
      onRemoveMappingRow={(index) => {
        const nextRows = mappingRows.filter((_, idx) => idx !== index);
        const safeRows =
          nextRows.length > 0
            ? nextRows
            : [{ id: createRowId(), path: '', responsePath: '', variable: '' }];
        syncMappingDraft(safeRows);
      }}
      onClose={() => store.setHeaderDialogOpen(false)}
    />
  );
});

export default HeaderDialog;
