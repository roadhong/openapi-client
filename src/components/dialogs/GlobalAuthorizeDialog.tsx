import { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { HeaderMappingRule } from '../../types';
import { useApiStore } from '../../store/api/ApiStoreContext';

type SecurityScheme = {
  name: string;
  type?: string;
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  description?: string;
  openIdConnectUrl?: string;
  variables?: Array<{
    name: string;
    defaultValue?: string;
    description?: string;
  }>;
};

type MappingRow = HeaderMappingRule & { id: string };

type GlobalAuthorizeDialogViewProps = {
  open: boolean;
  schemes: SecurityScheme[];
  values: Record<string, Record<string, unknown>>;
  scopes: Record<string, string[]>;
  mappingRows: MappingRow[];
  onClose: () => void;
  onSetGlobalSecurityValue: (
    schemeName: string,
    nextValue: Record<string, unknown>
  ) => void;
  onToggleGlobalScope: (schemeName: string, scope: string) => void;
  onGetSecurityScopes: (schemeName: string) => string[];
  onGetOAuth2Flows: (
    schemeName: string
  ) => Record<string, Record<string, unknown> | undefined>;
  onBuildImplicitAuthUrl: (schemeName: string) => string;
  onBuildAuthorizationCodeUrl: (schemeName: string) => string;
  onAddMappingRow: () => void;
  onUpdateMappingRow: (index: number, next: MappingRow) => void;
  onRemoveMappingRow: (index: number) => void;
  onConfirm: () => void;
};

const GlobalAuthorizeDialogView = observer(
  ({
    open,
    schemes,
    values,
    scopes,
    mappingRows,
    onClose,
    onSetGlobalSecurityValue,
    onToggleGlobalScope,
    onGetSecurityScopes,
    onGetOAuth2Flows,
    onBuildImplicitAuthUrl,
    onBuildAuthorizationCodeUrl,
    onAddMappingRow,
    onUpdateMappingRow,
    onRemoveMappingRow,
    onConfirm,
  }: GlobalAuthorizeDialogViewProps) => {
    if (!open) {
      return null;
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl rounded-xl bg-white dark:bg-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3 shrink-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Authorize
            </p>
          </div>
          <div className="space-y-6 p-4 overflow-y-auto">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                Security Schemes
              </div>
              {schemes.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  No security schemes.
                </p>
              ) : (
                schemes.map((scheme) => {
                  const value = values[scheme.name] ?? {};
                  const schemeType = scheme.type ?? 'unknown';
                  const availableScopes = onGetSecurityScopes(scheme.name);
                  return (
                    <div
                      key={scheme.name}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {scheme.name}{' '}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-300">
                          {schemeType}
                          {scheme.type === 'http' && scheme.scheme && (
                            <> · {scheme.scheme}</>
                          )}
                          {scheme.type === 'http' &&
                            scheme.scheme?.toLowerCase() === 'bearer' &&
                            scheme.bearerFormat && (
                              <> ({scheme.bearerFormat})</>
                            )}
                          {scheme.type === 'apiKey' && scheme.in && (
                            <> · in: {scheme.in}</>
                          )}
                          {scheme.type === 'apiKey' && scheme.name && (
                            <> · name: {scheme.name}</>
                          )}
                        </span>
                      </div>
                      {scheme.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          {scheme.description}
                        </p>
                      )}
                      <div className="mt-2 space-y-2">
                        {scheme.type === 'apiKey' && (
                          <div className="space-y-1">
                            <input
                              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                              placeholder={`${scheme.in} api key (can use {{var}})`}
                              value={
                                typeof value?.value === 'string'
                                  ? value.value
                                  : ''
                              }
                              onChange={(event) =>
                                onSetGlobalSecurityValue(scheme.name, {
                                  ...value,
                                  value: event.target.value,
                                })
                              }
                            />
                            {scheme.name && (
                              <p className="text-xs text-slate-400 dark:text-slate-300">
                                Header/Query/Cookie name: {scheme.name}
                              </p>
                            )}
                          </div>
                        )}
                        {scheme.type === 'http' && (
                          <div className="space-y-2">
                            {scheme.scheme === 'basic' ? (
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                  placeholder="Username (can use {{var}})"
                                  value={
                                    typeof value?.username === 'string'
                                      ? value.username
                                      : ''
                                  }
                                  onChange={(event) =>
                                    onSetGlobalSecurityValue(scheme.name, {
                                      ...value,
                                      username: event.target.value,
                                    })
                                  }
                                />
                                <input
                                  className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                  placeholder="Password (can use {{var}})"
                                  type="password"
                                  value={
                                    typeof value?.password === 'string'
                                      ? value.password
                                      : ''
                                  }
                                  onChange={(event) =>
                                    onSetGlobalSecurityValue(scheme.name, {
                                      ...value,
                                      password: event.target.value,
                                    })
                                  }
                                />
                              </div>
                            ) : (
                              <>
                                <input
                                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                  placeholder={
                                    scheme.scheme?.toLowerCase() === 'bearer'
                                      ? `Bearer token${
                                          scheme.bearerFormat
                                            ? ` (${scheme.bearerFormat})`
                                            : ''
                                        } (can use {{var}})`
                                      : `Token (can use {{var}})`
                                  }
                                  value={
                                    scheme.scheme?.toLowerCase() === 'bearer'
                                      ? typeof value?.value === 'string'
                                        ? value.value
                                        : 'Bearer '
                                      : typeof value?.value === 'string'
                                        ? value.value
                                        : ''
                                  }
                                  onChange={(event) =>
                                    onSetGlobalSecurityValue(scheme.name, {
                                      ...value,
                                      value: event.target.value,
                                    })
                                  }
                                />
                                {scheme.scheme &&
                                  scheme.scheme.toLowerCase() !== 'basic' &&
                                  scheme.scheme.toLowerCase() !== 'bearer' && (
                                    <p className="text-xs text-slate-400 dark:text-slate-300">
                                      Scheme: {scheme.scheme}
                                    </p>
                                  )}
                                {scheme.bearerFormat &&
                                  scheme.scheme?.toLowerCase() === 'bearer' && (
                                    <p className="text-xs text-slate-400 dark:text-slate-300">
                                      Bearer Format: {scheme.bearerFormat}
                                    </p>
                                  )}
                              </>
                            )}
                          </div>
                        )}
                        {(scheme.type === 'oauth2' ||
                          scheme.type === 'openIdConnect') && (
                          <div className="space-y-2">
                            <input
                              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                              placeholder={
                                scheme.type === 'openIdConnect'
                                  ? 'ID token (Bearer) (can use {{var}})'
                                  : 'Access token (Bearer) (can use {{var}})'
                              }
                              value={
                                typeof value?.value === 'string'
                                  ? value.value
                                  : ''
                              }
                              onChange={(event) =>
                                onSetGlobalSecurityValue(scheme.name, {
                                  ...value,
                                  value: event.target.value,
                                })
                              }
                            />
                            {scheme.type === 'oauth2' && (
                              <div className="space-y-1 text-xs text-slate-500 dark:text-slate-300">
                                {(() => {
                                  const flows = onGetOAuth2Flows(scheme.name);
                                  const flowEntries = Object.entries(
                                    flows
                                  ).filter(([, flow]) => flow !== undefined);
                                  if (flowEntries.length > 0) {
                                    return (
                                      <div className="text-slate-400 mb-1">
                                        Flows:{' '}
                                        {flowEntries
                                          .map(([name]) => name)
                                          .join(', ')}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                                {(() => {
                                  const flows = onGetOAuth2Flows(scheme.name);
                                  const flowEntries = Object.entries(
                                    flows
                                  ).filter(([, flow]) => flow !== undefined);
                                  return flowEntries.map(([flowName, flow]) => {
                                      if (!flow) {
                                        return null;
                                      }
                                      if (
                                        flowName === 'implicit' &&
                                        flow?.authorizationUrl
                                      ) {
                                        return (
                                          <div key={flowName}>
                                            <a
                                              className="underline"
                                              href={onBuildImplicitAuthUrl(
                                                scheme.name
                                              )}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              {flowName} authorize
                                            </a>
                                            {typeof flow?.refreshUrl ===
                                              'string' && (
                                              <span className="text-slate-400">
                                                {' '}
                                                · refresh: {flow.refreshUrl}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }
                                      if (
                                        flowName === 'authorizationCode' &&
                                        flow?.authorizationUrl
                                      ) {
                                        return (
                                          <div key={flowName}>
                                            <a
                                              className="underline"
                                              href={onBuildAuthorizationCodeUrl(
                                                scheme.name
                                              )}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              {flowName} authorize
                                            </a>
                                            {typeof flow?.tokenUrl ===
                                              'string' && (
                                              <span className="text-slate-400">
                                                {' '}
                                                · token: {flow.tokenUrl}
                                              </span>
                                            )}
                                            {typeof flow?.refreshUrl ===
                                              'string' && (
                                              <span className="text-slate-400">
                                                {' '}
                                                · refresh: {flow.refreshUrl}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }
                                      if (
                                        flowName === 'password' &&
                                        flow?.tokenUrl
                                      ) {
                                        return (
                                          <div key={flowName}>
                                            {flowName} · token:{' '}
                                            {typeof flow?.tokenUrl === 'string'
                                              ? flow.tokenUrl
                                              : ''}
                                            {typeof flow?.refreshUrl ===
                                              'string' && (
                                              <span className="text-slate-400">
                                                {' '}
                                                · refresh: {flow.refreshUrl}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }
                                      if (
                                        flowName === 'clientCredentials' &&
                                        flow?.tokenUrl
                                      ) {
                                        return (
                                          <div key={flowName}>
                                            {flowName} · token:{' '}
                                            {typeof flow?.tokenUrl === 'string'
                                              ? flow.tokenUrl
                                              : ''}
                                            {typeof flow?.refreshUrl ===
                                              'string' && (
                                              <span className="text-slate-400">
                                                {' '}
                                                · refresh: {flow.refreshUrl}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }
                                      return null;
                                    }
                                  );
                                })()}
                              </div>
                            )}
                            {scheme.type === 'openIdConnect' &&
                              scheme.openIdConnectUrl && (
                                <div className="text-xs text-slate-500">
                                  <div className="text-slate-400 mb-1">
                                    Discovery URL:
                                  </div>
                                  <a
                                    className="underline break-all"
                                    href={scheme.openIdConnectUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {scheme.openIdConnectUrl}
                                  </a>
                                </div>
                              )}
                          </div>
                        )}
                        {availableScopes.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-2">
                            {availableScopes.map((scope) => (
                              <label
                                key={scope}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="checkbox"
                                  checked={(scopes[scheme.name] ?? []).includes(
                                    scope
                                  )}
                                  onChange={() =>
                                    onToggleGlobalScope(scheme.name, scope)
                                  }
                                />
                                {scope}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
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
                onClick={onConfirm}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

const GlobalAuthorizeDialog = observer(() => {
  const store = useApiStore();
  const nextRowId = useRef(0);
  const createRowId = () => `row-${(nextRowId.current += 1)}`;

  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);

  useEffect(() => {
    if (!store.globalAuthDialogOpen) {
      return;
    }
    setMappingRows(
      store.headerMappingDraft.length > 0
        ? store.headerMappingDraft.map((row) => ({
            ...row,
            id: createRowId(),
          }))
        : [{ id: createRowId(), path: '', responsePath: '', variable: '' }]
    );
  }, [store.globalAuthDialogOpen, store.headerMappingDraft]);

  const buildMappingDraft = useCallback(
    (nextRows: MappingRow[]) =>
      nextRows.map((row) => ({
        path: row.path.trim(),
        responsePath: row.responsePath.trim(),
        variable: row.variable.trim(),
      })),
    []
  );

  const handleAddMappingRow = useCallback(() => {
    setMappingRows((prev) => [
      ...prev,
      { id: createRowId(), path: '', responsePath: '', variable: '' },
    ]);
  }, []);

  const handleUpdateMappingRow = useCallback(
    (index: number, next: MappingRow) => {
      setMappingRows((prev) =>
        prev.map((item, rowIndex) => (rowIndex === index ? next : item))
      );
    },
    []
  );

  const handleRemoveMappingRow = useCallback((index: number) => {
    setMappingRows((prev) => {
      const nextRows = prev.filter((_, rowIndex) => rowIndex !== index);
      return nextRows.length > 0
        ? nextRows
        : [{ id: createRowId(), path: '', responsePath: '', variable: '' }];
    });
  }, []);

  const handleClose = useCallback(
    () => store.setGlobalAuthDialogOpen(false),
    [store]
  );

  const handleConfirm = useCallback(() => {
    store.setHeaderMappingDraft(buildMappingDraft(mappingRows));
    store.setGlobalAuthDialogOpen(false);
  }, [buildMappingDraft, mappingRows, store]);

  return (
    <GlobalAuthorizeDialogView
      open={store.globalAuthDialogOpen}
      schemes={store.securitySchemeList}
      values={store.globalSecurityValues}
      scopes={store.globalSecurityScopes}
      mappingRows={mappingRows}
      onClose={handleClose}
      onSetGlobalSecurityValue={store.setGlobalSecurityValue}
      onToggleGlobalScope={store.toggleGlobalScope}
      onGetSecurityScopes={store.getSecurityScopes}
      onGetOAuth2Flows={store.getOAuth2Flows}
      onBuildImplicitAuthUrl={store.buildImplicitAuthUrl}
      onBuildAuthorizationCodeUrl={store.buildAuthorizationCodeUrl}
      onAddMappingRow={handleAddMappingRow}
      onUpdateMappingRow={handleUpdateMappingRow}
      onRemoveMappingRow={handleRemoveMappingRow}
      onConfirm={handleConfirm}
    />
  );
});

export default GlobalAuthorizeDialog;
