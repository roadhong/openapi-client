import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { HeaderMappingRule } from '../../types';
import { useApiStore } from '../../store/ApiStore';

const HeaderDialog = observer(() => {
  const store = useApiStore();
  const open = store.headerDialogOpen;
  const headerDraft = store.headerDraft;
  const mappingDraft = store.headerMappingDraft;
  const nextRowId = useRef(0);
  const createRowId = () => `row-${(nextRowId.current += 1)}`;

  const [rows, setRows] = useState<
    Array<{ id: string; key: string; value: string }>
  >([]);
  const [mappingRows, setMappingRows] = useState<
    Array<HeaderMappingRule & { id: string }>
  >([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const entries = Object.entries(headerDraft ?? {}).map(([key, value]) => ({
      id: createRowId(),
      key,
      value,
    }));
    setRows(
      entries.length > 0 ? entries : [{ id: createRowId(), key: '', value: '' }]
    );
    setMappingRows(
      mappingDraft.length > 0
        ? mappingDraft.map((row) => ({ ...row, id: createRowId() }))
        : [{ id: createRowId(), path: '', responsePath: '', variable: '' }]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const buildHeaderObject = (
    nextRows: Array<{ id: string; key: string; value: string }>
  ) =>
    nextRows.reduce<Record<string, string>>((acc, row) => {
      const trimmedKey = row.key.trim();
      if (!trimmedKey) {
        return acc;
      }
      acc[trimmedKey] = row.value;
      return acc;
    }, {});

  const buildMappingDraft = (
    nextRows: Array<HeaderMappingRule & { id: string }>
  ) =>
    nextRows.map((row) => ({
      path: row.path.trim(),
      responsePath: row.responsePath.trim(),
      variable: row.variable.trim(),
    }));

  const addRow = () => {
    setRows((prev) => {
      const nextRows = [...prev, { id: createRowId(), key: '', value: '' }];
      store.setHeaderDraft(buildHeaderObject(nextRows));
      return nextRows;
    });
  };

  const updateRow = (
    index: number,
    next: { id: string; key: string; value: string }
  ) => {
    setRows((prev) => {
      const nextRows = prev.map((item, rowIndex) =>
        rowIndex === index ? next : item
      );
      store.setHeaderDraft(buildHeaderObject(nextRows));
      return nextRows;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => {
      const nextRows = prev.filter((_, rowIndex) => rowIndex !== index);
      const safeRows =
        nextRows.length > 0
          ? nextRows
          : [{ id: createRowId(), key: '', value: '' }];
      store.setHeaderDraft(buildHeaderObject(safeRows));
      return safeRows;
    });
  };

  const addMappingRow = () => {
    setMappingRows((prev) => {
      const nextRows = [
        ...prev,
        { id: createRowId(), path: '', responsePath: '', variable: '' },
      ];
      store.setHeaderMappingDraft(buildMappingDraft(nextRows));
      return nextRows;
    });
  };

  const updateMappingRow = (
    index: number,
    next: HeaderMappingRule & { id: string }
  ) => {
    setMappingRows((prev) => {
      const nextRows = prev.map((item, rowIndex) =>
        rowIndex === index ? next : item
      );
      store.setHeaderMappingDraft(buildMappingDraft(nextRows));
      return nextRows;
    });
  };

  const removeMappingRow = (index: number) => {
    setMappingRows((prev) => {
      const nextRows = prev.filter((_, rowIndex) => rowIndex !== index);
      const safeRows =
        nextRows.length > 0
          ? nextRows
          : [{ id: createRowId(), path: '', responsePath: '', variable: '' }];
      store.setHeaderMappingDraft(buildMappingDraft(safeRows));
      return safeRows;
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => store.setHeaderDialogOpen(false)}
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
                onClick={addRow}
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
                      updateRow(index, { ...row, key: event.target.value });
                    }}
                  />
                  <input
                    className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                    placeholder="Value"
                    value={row.value}
                    onChange={(event) => {
                      updateRow(index, { ...row, value: event.target.value });
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => removeRow(index)}
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
                onClick={addMappingRow}
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
                      updateMappingRow(index, {
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
                      updateMappingRow(index, {
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
                      updateMappingRow(index, {
                        ...row,
                        variable: event.target.value,
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => removeMappingRow(index)}
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
              onClick={() => store.setHeaderDialogOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default HeaderDialog;
