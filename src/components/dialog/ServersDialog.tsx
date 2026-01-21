import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useApiStore } from '../../store/ApiStore';

type ServerItem = {
  url: string;
  description?: string;
  templateUrl?: string;
  variables?: Array<{
    name: string;
    defaultValue?: string;
    description?: string;
  }>;
};

const ServersDialog = observer(() => {
  const store = useApiStore();
  const open = store.serverDialogOpen;
  const metadataServers = store.metadataServers;
  const metadataServerVariables = store.metadataServerVariables;
  const serverDraft = store.serverDraft;
  const nextRowId = useRef(0);
  const createRowId = () => `server-${(nextRowId.current += 1)}`;

  const [rows, setRows] = useState<Array<ServerItem & { id: string }>>([]);
  const [metadataVariableValues, setMetadataVariableValues] = useState<
    Record<number, Record<string, string>>
  >({});

  useEffect(() => {
    if (!open) {
      return;
    }
    const entries = serverDraft.map((server) => ({
      id: createRowId(),
      ...server,
    }));
    setRows(entries.length > 0 ? entries : [{ id: createRowId(), url: '' }]);
    const defaults = metadataServers.reduce<
      Record<number, Record<string, string>>
    >((acc, server, index) => {
      const templateUrl = server.templateUrl ?? server.url;
      const values = templateUrl
        ? metadataServerVariables[templateUrl]
        : undefined;
      if (values) {
        acc[index] = values;
        return acc;
      }
      const templateDefaults =
        server.variables?.reduce<Record<string, string>>((vars, variable) => {
          const defaultValue = variable.defaultValue ?? '';
          vars[variable.name] = defaultValue;
          return vars;
        }, {}) ?? {};
      acc[index] = templateDefaults;
      return acc;
    }, {});
    setMetadataVariableValues(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const buildServers = (nextRows: Array<ServerItem & { id: string }>) =>
    nextRows.map(({ url, description }) => ({
      url: url.trim(),
      description: description?.trim() || undefined,
    }));

  const addRow = () => {
    setRows((prev) => {
      const nextRows = [...prev, { id: createRowId(), url: '' }];
      store.setServerDraft(buildServers(nextRows));
      return nextRows;
    });
  };

  const updateRow = (index: number, next: ServerItem & { id: string }) => {
    setRows((prev) => {
      const nextRows = prev.map((item, rowIndex) =>
        rowIndex === index ? next : item
      );
      store.setServerDraft(buildServers(nextRows));
      return nextRows;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => {
      const nextRows = prev.filter((_, rowIndex) => rowIndex !== index);
      const safeRows =
        nextRows.length > 0 ? nextRows : [{ id: createRowId(), url: '' }];
      store.setServerDraft(buildServers(safeRows));
      return safeRows;
    });
  };

  const resolveServerUrl = (
    template: string,
    values: Record<string, string>
  ) => {
    if (!template) {
      return '';
    }
    return template.replace(/{([^}]+)}/g, (_, key) => {
      const value = values[key];
      return value ? value : `{${key}}`;
    });
  };

  const updateMetadataVariable = (
    index: number,
    name: string,
    value: string
  ) => {
    setMetadataVariableValues((prev) => {
      const next = {
        ...prev,
        [index]: {
          ...(prev[index] ?? {}),
          [name]: value,
        },
      };
      const server = metadataServers[index];
      const key = server?.templateUrl ?? server?.url ?? '';
      if (key) {
        store.setMetadataServerVariable(key, next[index]);
      }
      return next;
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        store.resetServerDraft();
        store.setServerDialogOpen(false);
      }}
    >
      <div
        className="w-full max-w-3xl rounded-xl bg-white dark:bg-slate-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Servers
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
              Metadata Servers
            </div>
            {metadataServers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">None</p>
            ) : (
              <div className="space-y-2">
                {metadataServers.map((server, index) => {
                  const templateUrl = server.templateUrl ?? server.url;
                  const values = metadataVariableValues[index] ?? {};
                  const resolvedUrl = resolveServerUrl(templateUrl, values);
                  const serverKey = templateUrl;
                  return (
                    <div
                      key={`${server.url}-${index}`}
                      className="flex items-start gap-2"
                    >
                      <div className="flex-1 space-y-1">
                        <input
                          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-sm text-slate-500 dark:text-slate-300"
                          value={resolvedUrl || templateUrl}
                          disabled
                        />
                        {server.description && (
                          <p className="text-xs text-slate-400 dark:text-slate-300">
                            {server.description}
                          </p>
                        )}
                        {server.templateUrl &&
                          server.templateUrl !== server.url && (
                            <p className="text-xs text-slate-400 dark:text-slate-300">
                              Template: {server.templateUrl}
                            </p>
                          )}
                        {server.variables && server.variables.length > 0 && (
                          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-300">
                            {server.variables.map((variable) => (
                              <div
                                key={variable.name}
                                className="flex items-center gap-2"
                              >
                                <span className="w-16 text-slate-500">
                                  {variable.name}
                                </span>
                                <input
                                  className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                                  value={
                                    values[variable.name] ??
                                    variable.defaultValue ??
                                    ''
                                  }
                                  onChange={(event) =>
                                    updateMetadataVariable(
                                      index,
                                      variable.name,
                                      event.target.value
                                    )
                                  }
                                />
                                {variable.description && (
                                  <span className="text-slate-400 dark:text-slate-300">
                                    {variable.description}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        onClick={() => {
                          const url = resolvedUrl || server.url;
                          if (!url) {
                            return;
                          }
                          if (serverKey) {
                            store.setActiveServerFromMetadata(serverKey, url);
                          } else {
                            store.clearActiveServerKey();
                            store.setActiveServerUrl(url);
                          }
                          store.setServerDialogOpen(false);
                        }}
                      >
                        Use
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
              <span>Custom Servers</span>
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
                    className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                    placeholder="Server URL"
                    value={row.url}
                    onChange={(event) =>
                      updateRow(index, { ...row, url: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => {
                      if (!row.url) {
                        return;
                      }
                      store.clearActiveServerKey();
                      store.setActiveServerUrl(row.url);
                      store.setServerDialogOpen(false);
                    }}
                  >
                    Use
                  </button>
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
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => {
                store.resetServerDraft();
                store.setServerDialogOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ServersDialog;
