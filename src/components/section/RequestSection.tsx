import { useMemo, useState, type ChangeEvent } from 'react';
import { observer } from 'mobx-react-lite';
import CodeMirror from '@uiw/react-codemirror';
import { json5 } from 'codemirror-json5';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import JSON5 from 'json5';
import MethodBadge from '../others/MethodBadge';
import SchemaViewer from '../others/SchemaViewer';
import { useApiStore } from '../../store/ApiStore';

type RequestSectionProps = {
  isStacked?: boolean;
};

const RequestSection = observer(
  ({ isStacked = false }: RequestSectionProps) => {
    const store = useApiStore();
    const selectedApi = store.selectedApi;
    const pathParams = store.pathParams;
    const queryParams = store.queryParams;
    const headerParams = store.headerParams;
    const requestBody = store.requestBody;
    const requestSchema = store.requestSchema;
    const requestContentType = store.requestContentType;
    const requestContentTypeOptions = store.requestContentTypeOptions;
    const requestBodiesByContentType = Object.fromEntries(
      store.requestContentTypeOptions.map((type) => [
        type,
        store.getRequestBodyForContentType(type),
      ])
    );
    const requestParameters = store.requestParameters;
    const requestCallbacks = store.requestCallbacks;
    const securitySchemes = store.securitySchemeList;
    const securityRequirements = store.requestSecurityRequirements;
    const selectedSecurityRequirementIndex =
      store.selectedSecurityRequirementIndex;
    const securityValues = store.securityValues;
    const [activeTab, setActiveTab] = useState<'request' | 'schema'>('request');
    const buildParamOptions = (schemaValue: Record<string, unknown>) => {
      const options: string[] = [];
      let example: string | undefined;
      if (schemaValue?.format) {
        options.push(`format=${schemaValue.format}`);
      }
      if (Array.isArray(schemaValue?.enum) && schemaValue.enum.length > 0) {
        options.push(`enum=${schemaValue.enum.map(String).join(', ')}`);
      }
      if (schemaValue?.minimum !== undefined) {
        options.push(`min=${schemaValue.minimum}`);
      }
      if (schemaValue?.maximum !== undefined) {
        options.push(`max=${schemaValue.maximum}`);
      }
      if (schemaValue?.minLength !== undefined) {
        options.push(`minLength=${schemaValue.minLength}`);
      }
      if (schemaValue?.maxLength !== undefined) {
        options.push(`maxLength=${schemaValue.maxLength}`);
      }
      if (schemaValue?.pattern) {
        options.push(`pattern=${schemaValue.pattern}`);
      }
      if (schemaValue?.minItems !== undefined) {
        options.push(`minItems=${schemaValue.minItems}`);
      }
      if (schemaValue?.maxItems !== undefined) {
        options.push(`maxItems=${schemaValue.maxItems}`);
      }
      if (schemaValue?.example !== undefined) {
        example = String(schemaValue.example);
      }
      return { options, example };
    };

    const paramMeta = useMemo(() => {
      return requestParameters.reduce<
        Record<
          string,
          { description?: string; options?: string[]; example?: string }
        >
      >((acc, param) => {
        if (!param?.name || !param?.in) {
          return acc;
        }
        const schemaValue = (param.schema && typeof param.schema === 'object' && !Array.isArray(param.schema) ? param.schema : param) as Record<string, unknown>;
        const { options, example } = buildParamOptions(schemaValue);
        acc[`${param.in}:${param.name}`] = {
          description: typeof param.description === 'string' ? param.description : undefined,
          options,
          example,
        };
        return acc;
      }, {});
    }, [requestParameters]);

    const activeSecurityRequirement =
      securityRequirements[selectedSecurityRequirementIndex] ??
      securityRequirements[0] ??
      null;
    const securitySchemeMap = useMemo(
      () =>
        securitySchemes.reduce<
          Record<string, (typeof securitySchemes)[number]>
        >((acc, scheme) => {
          acc[scheme.name] = scheme;
          return acc;
        }, {}),
      [securitySchemes]
    );
    const callbackEntries = useMemo(
      () => Object.entries(requestCallbacks ?? {}),
      [requestCallbacks]
    );

    const isJsonContentType = (contentType: string | null) => {
      if (!contentType) {
        return true;
      }
      return (
        contentType === 'application/json' ||
        contentType.endsWith('+json') ||
        contentType.includes('json')
      );
    };

    const handleSend = () => {
      if (requestBody.trim() && isJsonContentType(requestContentType)) {
        try {
          const parsed = JSON5.parse(requestBody);
          const formatted = JSON5.stringify(parsed, null, 2);
          if (formatted !== requestBody) {
            store.setRequestBody(formatted);
          }
        } catch {
          // ignore formatting errors and let sendRequest handle invalid JSON
        }
      }
      store.sendRequest();
    };

    return (
      <section
        className={`flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm ${isStacked ? '' : 'min-h-0'}`}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Request
          </p>
          <button
            type="button"
            className="ml-auto rounded-md bg-blue-600 dark:bg-blue-700 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
            onClick={handleSend}
            disabled={!selectedApi}
          >
            Send
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${activeTab === 'request' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'}`}
            onClick={() => setActiveTab('request')}
          >
            Request
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${activeTab === 'schema' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'}`}
            onClick={() => setActiveTab('schema')}
          >
            Schema
          </button>
        </div>
        <div
          className={`space-y-4 p-4 ${isStacked ? '' : 'flex-1 overflow-auto'}`}
        >
          {selectedApi ? (
            <>
              {activeTab === 'request' ? (
                <>
                  <div className="space-y-2">
                    <div>
                      <p className="text-base font-semibold flex items-center gap-2">
                        <MethodBadge method={selectedApi.method} />
                        {selectedApi.path}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                        Summary
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {selectedApi.summary || 'None'}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                        Description
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {selectedApi.description || 'None'}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                        Callbacks
                      </p>
                      {callbackEntries.length === 0 ? (
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                          None
                        </p>
                      ) : (
                        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                          {callbackEntries.map(([name, callback]) => (
                            <div key={name} className="space-y-1">
                              <div className="font-semibold">{name}</div>
                              {Object.entries(callback ?? {}).map(
                                ([expression, methods]) => (
                                  <div
                                    key={expression}
                                    className="text-xs text-slate-600 dark:text-slate-300"
                                  >
                                    {expression}
                                    <div className="mt-1 text-slate-500 dark:text-slate-300">
                                      {Object.keys(methods ?? {}).join(', ')}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                      Security
                    </p>
                    {securityRequirements.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-300">
                        None
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {securityRequirements.map((requirement, index) => {
                            const entries = Object.entries(requirement ?? {});
                            const label =
                              entries.length > 0
                                ? entries
                                    .map(([name, scopes]) =>
                                      Array.isArray(scopes) && scopes.length > 0
                                        ? `${name}(${scopes.join(', ')})`
                                        : name
                                    )
                                    .join(' + ')
                                : 'No auth';
                            return (
                              <button
                                key={`security-${index}`}
                                type="button"
                                className={`rounded-full px-3 py-1 ${
                                  index === selectedSecurityRequirementIndex
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                    : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                                onClick={() =>
                                  store.setSecurityRequirementIndex(index)
                                }
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        {activeSecurityRequirement &&
                        Object.keys(activeSecurityRequirement).length > 0 ? (
                          <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                            {Object.keys(activeSecurityRequirement).map(
                              (schemeName) => {
                                const scheme = securitySchemeMap[schemeName];
                                // Get default value from globalSecurityValues if securityValues is not available
                                const value =
                                  securityValues[schemeName] ??
                                  store.globalSecurityValues[schemeName] ??
                                  {};
                                const scopes =
                                  activeSecurityRequirement[schemeName] ?? [];
                                if (!scheme) {
                                  return (
                                    <div
                                      key={schemeName}
                                      className="text-xs text-slate-500 dark:text-slate-300"
                                    >
                                      {schemeName} (unknown scheme)
                                    </div>
                                  );
                                }
                                if (scheme.type === 'apiKey') {
                                  return (
                                    <div
                                      key={schemeName}
                                      className="flex flex-col gap-1 text-xs text-slate-600"
                                    >
                                      <div>
                                        {schemeName}{' '}
                                        <span className="text-slate-400 dark:text-slate-300">
                                          {scheme.in}
                                          {scheme.name &&
                                            ` · name: ${scheme.name}`}{' '}
                                          · {scheme.description || 'API key'}
                                        </span>
                                      </div>
                                      <input
                                        className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                        placeholder={
                                          scheme.name
                                            ? `${scheme.in} api key (${scheme.name})`
                                            : `${scheme.in} api key`
                                        }
                                        value={typeof value?.value === 'string' ? value.value : ''}
                                        onChange={(event) =>
                                          store.setSecurityValue(schemeName, {
                                            ...value,
                                            value: event.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                  );
                                }
                                if (scheme.type === 'http') {
                                  const schemeType = String(
                                    scheme.scheme ?? ''
                                  ).toLowerCase();
                                  if (schemeType === 'basic') {
                                    return (
                                      <div
                                        key={schemeName}
                                        className="space-y-1 text-xs text-slate-600 dark:text-slate-300"
                                      >
                                        <div>
                                          {schemeName}{' '}
                                          <span className="text-slate-400 dark:text-slate-300">
                                            Basic ·{' '}
                                            {scheme.description || 'HTTP Basic'}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <input
                                            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                            placeholder="Username"
                                            value={typeof value?.username === 'string' ? value.username : ''}
                                            onChange={(event) =>
                                              store.setSecurityValue(
                                                schemeName,
                                                {
                                                  ...value,
                                                  username: event.target.value,
                                                }
                                              )
                                            }
                                          />
                                          <input
                                            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                            placeholder="Password"
                                            type="password"
                                            value={typeof value?.password === 'string' ? value.password : ''}
                                            onChange={(event) =>
                                              store.setSecurityValue(
                                                schemeName,
                                                {
                                                  ...value,
                                                  password: event.target.value,
                                                }
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                    );
                                  }
                                  const isBearer = schemeType === 'bearer';
                                  // Get default value from globalSecurityValues for Bearer tokens
                                  const getValue = (val: unknown): string => {
                                    return typeof val === 'string' ? val : '';
                                  };
                                  const inputValue = isBearer
                                    ? (getValue(value?.value) ||
                                      getValue(store.globalSecurityValues[schemeName]?.value) ||
                                      '')
                                    : getValue(value?.value);
                                  return (
                                    <label
                                      key={schemeName}
                                      className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300"
                                    >
                                      {schemeName}{' '}
                                      <span className="text-slate-400 dark:text-slate-500">
                                        {scheme.scheme || 'http'}
                                        {isBearer && scheme.bearerFormat
                                          ? ` (${scheme.bearerFormat})`
                                          : ''}{' '}
                                        · {scheme.description || 'HTTP auth'}
                                      </span>
                                      <input
                                        className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                        placeholder={
                                          isBearer
                                            ? `Bearer token${scheme.bearerFormat ? ` (${scheme.bearerFormat})` : ''}`
                                            : 'Token'
                                        }
                                        value={inputValue}
                                        onChange={(event) =>
                                          store.setSecurityValue(schemeName, {
                                            ...value,
                                            value: event.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                  );
                                }
                                if (scheme.type === 'oauth2') {
                                  const flows = scheme.flows ?? {};
                                  const flowEntries = Object.entries(flows);
                                  return (
                                    <div
                                      key={schemeName}
                                      className="space-y-1 text-xs text-slate-600 dark:text-slate-300"
                                    >
                                      <div>
                                        {schemeName}{' '}
                                        <span className="text-slate-400 dark:text-slate-300">
                                          OAuth2
                                          {flowEntries.length > 0 &&
                                            ` · flows: ${flowEntries.map(([name]) => name).join(', ')}`}{' '}
                                          · {scheme.description || 'Token'}
                                        </span>
                                      </div>
                                      <input
                                        className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                        placeholder="Access token (Bearer)"
                                        value={typeof value?.value === 'string' ? value.value : ''}
                                        onChange={(event) =>
                                          store.setSecurityValue(schemeName, {
                                            ...value,
                                            value: event.target.value,
                                          })
                                        }
                                      />
                                      {flowEntries.length > 0 && (
                                        <div className="space-y-1 text-xs text-slate-500 dark:text-slate-300">
                                          {flowEntries.map(([flowName, flow]) => {
                                            if (typeof flowName !== 'string' || !(flow && typeof flow === 'object' && !Array.isArray(flow))) {
                                              return null;
                                            }
                                            const flowObj = flow as Record<string, unknown>;
                                            return (
                                              <div key={flowName}>
                                                {flowName}
                                                {typeof flowObj?.authorizationUrl === 'string' && (
                                                  <span>
                                                    {' '}
                                                    ·{' '}
                                                    <a
                                                      className="underline"
                                                      href={flowObj.authorizationUrl}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                    >
                                                      auth
                                                    </a>
                                                  </span>
                                                )}
                                                {typeof flowObj?.tokenUrl === 'string' && (
                                                  <span>
                                                    {' '}
                                                    ·{' '}
                                                    <a
                                                      className="underline"
                                                      href={flowObj.tokenUrl}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                    >
                                                      token
                                                    </a>
                                                  </span>
                                                )}
                                                {typeof flowObj?.refreshUrl === 'string' && (
                                                  <span>
                                                    {' '}
                                                    ·{' '}
                                                    <a
                                                      className="underline"
                                                      href={flowObj.refreshUrl}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                    >
                                                      refresh
                                                    </a>
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {Array.isArray(scopes) &&
                                        scopes.length > 0 && (
                                          <span className="text-xs text-slate-400 dark:text-slate-300">
                                            scopes: {scopes.join(', ')}
                                          </span>
                                        )}
                                    </div>
                                  );
                                }
                                if (scheme.type === 'openIdConnect') {
                                  return (
                                    <div
                                      key={schemeName}
                                      className="space-y-1 text-xs text-slate-600 dark:text-slate-300"
                                    >
                                      <div>
                                        {schemeName}{' '}
                                        <span className="text-slate-400 dark:text-slate-300">
                                          OpenID Connect
                                          {scheme.openIdConnectUrl &&
                                            ' · discovery'}{' '}
                                          · {scheme.description || 'Token'}
                                        </span>
                                      </div>
                                      <input
                                        className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                        placeholder="ID token (Bearer)"
                                        value={typeof value?.value === 'string' ? value.value : ''}
                                        onChange={(event) =>
                                          store.setSecurityValue(schemeName, {
                                            ...value,
                                            value: event.target.value,
                                          })
                                        }
                                      />
                                      {scheme.openIdConnectUrl && (
                                        <div className="text-xs text-slate-500 dark:text-slate-300">
                                          <a
                                            className="underline"
                                            href={scheme.openIdConnectUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            Discovery URL:{' '}
                                            {scheme.openIdConnectUrl}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <label
                                    key={schemeName}
                                    className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300"
                                  >
                                    {schemeName}{' '}
                                    <span className="text-slate-400 dark:text-slate-500">
                                      {scheme.type} ·{' '}
                                      {scheme.description || 'Token'}
                                    </span>
                                    <input
                                      className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-200"
                                      placeholder="Token"
                                      value={typeof value?.value === 'string' ? value.value : ''}
                                      onChange={(event) =>
                                        store.setSecurityValue(schemeName, {
                                          ...value,
                                          value: event.target.value,
                                        })
                                      }
                                    />
                                    {Array.isArray(scopes) &&
                                      scopes.length > 0 && (
                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                          scopes: {scopes.join(', ')}
                                        </span>
                                      )}
                                  </label>
                                );
                              }
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 dark:text-slate-300">
                            None
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                      Path Params
                    </p>
                    {Object.entries(pathParams).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-300">
                        None
                      </p>
                    ) : (
                      Object.entries(pathParams).map(([key, value]) => (
                        <label
                          key={key}
                          className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-300"
                        >
                          {key}
                          <input
                            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                            value={value}
                            placeholder={
                              paramMeta[`path:${key}`]?.example ?? ''
                            }
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              store.setPathParam(key, event.target.value)
                            }
                          />
                          {paramMeta[`path:${key}`]?.description ? (
                            <span className="text-xs text-slate-400 dark:text-slate-300 normal-case">
                              {paramMeta[`path:${key}`]?.description}
                            </span>
                          ) : null}
                          {paramMeta[`path:${key}`]?.options?.length ? (
                            <span className="text-xs text-slate-400 dark:text-slate-300 normal-case">
                              {paramMeta[`path:${key}`]?.options?.join(' · ')}
                            </span>
                          ) : null}
                        </label>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                      Query Params
                    </p>
                    {Object.entries(queryParams).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-300">
                        None
                      </p>
                    ) : (
                      Object.entries(queryParams).map(([key, value]) => (
                        <label
                          key={key}
                          className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-300"
                        >
                          {key}
                          <input
                            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                            value={value}
                            placeholder={
                              paramMeta[`query:${key}`]?.example ?? ''
                            }
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              store.setQueryParam(key, event.target.value)
                            }
                          />
                          {paramMeta[`query:${key}`]?.description ? (
                            <span className="text-xs text-slate-400 dark:text-slate-300 normal-case">
                              {paramMeta[`query:${key}`]?.description}
                            </span>
                          ) : null}
                          {paramMeta[`query:${key}`]?.options?.length ? (
                            <span className="text-xs text-slate-400 dark:text-slate-300 normal-case">
                              {paramMeta[`query:${key}`]?.options?.join(' · ')}
                            </span>
                          ) : null}
                        </label>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                      Header Params
                    </p>
                    {Object.entries(headerParams).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-300">
                        None
                      </p>
                    ) : (
                      Object.entries(headerParams).map(([key, value]) => (
                        <label
                          key={key}
                          className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-300"
                        >
                          {key}
                          <input
                            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                            value={value}
                            placeholder={
                              paramMeta[`header:${key}`]?.example ?? ''
                            }
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              store.setHeaderParam(key, event.target.value)
                            }
                          />
                          {paramMeta[`header:${key}`]?.description ? (
                            <span className="text-xs text-slate-400 dark:text-slate-300 normal-case">
                              {paramMeta[`header:${key}`]?.description}
                            </span>
                          ) : null}
                          {paramMeta[`header:${key}`]?.options?.length ? (
                            <span className="text-xs text-slate-400 dark:text-slate-300 normal-case">
                              {paramMeta[`header:${key}`]?.options?.join(' · ')}
                            </span>
                          ) : null}
                        </label>
                      ))
                    )}
                  </div>
                  <div className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                    <span>Request Body</span>
                    {selectedApi.requestBody ? (
                      requestContentTypeOptions.length === 0 ? (
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-300 normal-case">
                          None
                        </span>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 text-xs font-normal text-slate-400 dark:text-slate-300 normal-case">
                            Content-Type
                            <select
                              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                              value={requestContentType ?? ''}
                              onChange={(event) =>
                                store.setRequestContentType(event.target.value)
                              }
                            >
                              {requestContentTypeOptions.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 normal-case">
                            <CodeMirror
                              value={
                                requestContentType
                                  ? (requestBodiesByContentType[
                                      requestContentType
                                    ] ?? '')
                                  : requestBody
                              }
                              height="300px"
                              theme={store.darkMode ? githubDark : githubLight}
                              extensions={[json5()]}
                              onChange={(nextValue: string) => {
                                if (requestContentType) {
                                  store.setRequestBodyForContentType(
                                    requestContentType,
                                    nextValue
                                  );
                                } else {
                                  store.setRequestBody(nextValue);
                                }
                              }}
                            />
                          </div>
                          {requestContentType &&
                            store.getRequestBodyExamples(requestContentType)
                              .length > 0 && (
                              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                                  Examples
                                </p>
                                <div className="mt-2 space-y-2">
                                  {store
                                    .getRequestBodyExamples(requestContentType)
                                    .map((example) => (
                                      <div key={example.name}>
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                                          {example.name}
                                        </p>
                                        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 normal-case">
                                          <CodeMirror
                                            value={example.value}
                                            height="140px"
                                            theme={
                                              store.darkMode
                                                ? githubDark
                                                : githubLight
                                            }
                                            extensions={[json5()]}
                                            editable={false}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                        </>
                      )
                    ) : (
                      <span className="text-sm font-normal text-slate-500 normal-case">
                        None
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <SchemaViewer schema={requestSchema ?? null} />
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Select an API.</p>
          )}
        </div>
      </section>
    );
  }
);

export default RequestSection;
