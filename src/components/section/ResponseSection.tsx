import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import CodeMirror from '@uiw/react-codemirror';
import { json5 } from 'codemirror-json5';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import SchemaViewer from '../others/SchemaViewer';
import { useApiStore } from '../../store/ApiStore';

export type ResponseSectionProps = {
  isStacked?: boolean;
};

const ResponseSection = observer(
  ({ isStacked = false }: ResponseSectionProps) => {
    console.log('[ResponseSection] Rendering started');
    const renderStart = performance.now();

    const store = useApiStore();
    const selectedPath = store.selectedApi?.path;
    const response = store.response;
    const selectedApi = store.selectedApi;
    const [activeTab, setActiveTab] = useState<'response' | 'schema'>(
      'response'
    );
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [selectedContentType, setSelectedContentType] = useState<string>('');
    const [responseSchema, setResponseSchema] = useState<Record<string, unknown> | null>(null);
    const [schemaForStatus, setSchemaForStatus] = useState<Record<string, unknown> | null>(null);
    const [responseStatusOptions, setResponseStatusOptions] = useState<
      string[]
    >([]);

    // Load responseStatusOptions asynchronously
    useEffect(() => {
      console.log('[ResponseSection] useEffect: Loading responseStatusOptions');
      const loadOptions = async () => {
        const start = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const optionsStart = performance.now();
        const options = store.responseStatusOptions;
        console.log(
          `[ResponseSection] responseStatusOptions getter: ${performance.now() - optionsStart}ms`
        );
        setResponseStatusOptions(options);
        console.log(
          `[ResponseSection] responseStatusOptions loaded: ${performance.now() - start}ms`
        );
      };
      loadOptions();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedApi?.key]);

    // Load responseSchema asynchronously to prevent main thread blocking
    // Don't use responseSchema getter, call method directly for async processing
    useEffect(() => {
      console.log('[ResponseSection] useEffect: Loading responseSchema');
      const loadSchema = async () => {
        const start = performance.now();
        // Defer to next event loop to allow initial rendering to complete first
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Call getResponseSchemaForStatus directly instead of responseSchema getter
        // This ensures schema resolution only runs when needed
        const status = response.status ? String(response.status) : undefined;
        const schemaStart = performance.now();
        const schema = status ? store.getResponseSchemaForStatus(status) : null;
        console.log(
          `[ResponseSection] getResponseSchemaForStatus: ${performance.now() - schemaStart}ms`
        );
        setResponseSchema(schema ?? null);
        console.log(
          `[ResponseSection] responseSchema loaded: ${performance.now() - start}ms`
        );
      };
      loadSchema();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.selectedKey, store.response.status, response.status]);

    useEffect(() => {
      const currentStatus = response.status ? String(response.status) : '';
      if (currentStatus) {
        setSelectedStatus(currentStatus);
        return;
      }
      if (responseStatusOptions.length > 0) {
        setSelectedStatus(responseStatusOptions[0]);
      } else {
        setSelectedStatus('');
      }
    }, [response.status, responseStatusOptions]);

    const contentTypes = useMemo(() => {
      const start = performance.now();
      const result = store.getResponseContentTypesForStatus(selectedStatus);
      console.log(
        `[ResponseSection] useMemo contentTypes: ${performance.now() - start}ms`
      );
      return result;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedApi?.key, selectedStatus]);

    useEffect(() => {
      if (contentTypes.length > 0) {
        setSelectedContentType(contentTypes[0]);
      } else {
        setSelectedContentType('');
      }
    }, [contentTypes]);

    // Process schema resolution asynchronously to prevent main thread blocking
    useEffect(() => {
      console.log('[ResponseSection] useEffect: Loading schemaForStatus');
      const loadSchema = async () => {
        const start = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 0));
        let result: Record<string, unknown> | null = null;
        if (selectedContentType) {
          const methodStart = performance.now();
          result = store.getResponseSchemaForStatusAndContentType(
            selectedStatus,
            selectedContentType
          ) ?? null;
          console.log(
            `[ResponseSection] getResponseSchemaForStatusAndContentType: ${performance.now() - methodStart}ms`
          );
        } else {
          const methodStart = performance.now();
          result = selectedStatus
            ? (store.getResponseSchemaForStatus(selectedStatus) ?? null)
            : responseSchema;
          console.log(
            `[ResponseSection] getResponseSchemaForStatus: ${performance.now() - methodStart}ms`
          );
        }
        setSchemaForStatus(result);
        console.log(
          `[ResponseSection] schemaForStatus loaded: ${performance.now() - start}ms`
        );
      };
      loadSchema();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedApi?.key, responseSchema, selectedStatus, selectedContentType]);

    const responseExamples = useMemo(() => {
      const start = performance.now();
      const result = store.getResponseExamplesForStatus(
        selectedStatus,
        selectedContentType ?? ''
      );
      console.log(
        `[ResponseSection] useMemo responseExamples: ${performance.now() - start}ms`
      );
      return result;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedApi?.key, selectedStatus, selectedContentType]);
    const responseInfo = useMemo(() => {
      const start = performance.now();
      const result = store.getResponseInfoForStatus(selectedStatus);
      console.log(
        `[ResponseSection] useMemo responseInfo: ${performance.now() - start}ms`
      );
      return result;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedApi?.key, selectedStatus]);
    const historyItems = useMemo(() => {
      const start = performance.now();
      if (!store.responseHistory.length) {
        console.log(
          `[ResponseSection] useMemo historyItems: ${performance.now() - start}ms`
        );
        return [];
      }
      if (selectedPath) {
        const result = store.responseHistory.filter(
          (item) => item.path === selectedPath
        );
        console.log(
          `[ResponseSection] useMemo historyItems: ${performance.now() - start}ms`
        );
        return result;
      }
      console.log(
        `[ResponseSection] useMemo historyItems: ${performance.now() - start}ms`
      );
      return store.responseHistory;
    }, [store.responseHistory, selectedPath]);

    console.log(
      `[ResponseSection] Rendering completed: ${performance.now() - renderStart}ms`
    );

    return (
      <section
        className={`flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm ${isStacked ? '' : 'min-h-0'}`}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Response
          </p>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
            <span className="whitespace-nowrap">History</span>
            <select
              className="w-48 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 disabled:bg-slate-50 dark:disabled:bg-slate-800"
              onChange={(event) =>
                store.selectResponseHistory(event.target.value)
              }
              defaultValue=""
              disabled={historyItems.length === 0}
            >
              <option value="" disabled>
                {historyItems.length > 0 ? 'Select' : 'No history'}
              </option>
              {historyItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.timestamp).toLocaleTimeString()} ·{' '}
                  {item.method} {item.path} · {item.response.status ?? '-'}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${activeTab === 'response' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'}`}
            onClick={() => setActiveTab('response')}
          >
            Response
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${activeTab === 'schema' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'}`}
            onClick={() => setActiveTab('schema')}
          >
            Schema
          </button>
        </div>
        {activeTab === 'schema' && responseStatusOptions.length > 0 && (
          <div className="space-y-2 border-b border-slate-200 dark:border-slate-700 px-4 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {responseStatusOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`rounded-full px-3 py-1 ${
                    selectedStatus === status
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  onClick={() => setSelectedStatus(status)}
                >
                  {status.toUpperCase()}
                </button>
              ))}
            </div>
            {contentTypes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                {contentTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`rounded-full px-3 py-1 ${
                      selectedContentType === type
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                        : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                    onClick={() => setSelectedContentType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
            {(responseInfo.description ||
              (responseInfo.headers &&
                Object.keys(responseInfo.headers).length > 0)) && (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                  Spec Preview
                </p>
                {responseInfo.description ? (
                  <p className="mt-1">{responseInfo.description}</p>
                ) : null}
                {responseInfo.headers &&
                Object.keys(responseInfo.headers).length > 0 ? (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                    Headers: {Object.keys(responseInfo.headers).join(', ')}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
        <div
          className={`space-y-4 p-4 ${isStacked ? '' : 'flex-1 overflow-auto'}`}
        >
          {activeTab === 'response' ? (
            response.error ? (
              <p className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {response.error}
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Status: {response.status ?? '-'}
                </p>
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                  Headers
                  {/* Display response headers in JSON5 mode */}
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 normal-case">
                    <CodeMirror
                      value={response.headers ?? ''}
                      height="140px"
                      theme={store.darkMode ? githubDark : githubLight}
                      extensions={[json5()]}
                      editable={false}
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                  Body
                  {/* Display response body in JSON5 mode */}
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 normal-case">
                    <CodeMirror
                      value={response.body ?? ''}
                      height="500px"
                      theme={store.darkMode ? githubDark : githubLight}
                      extensions={[json5()]}
                      editable={false}
                    />
                  </div>
                </label>
              </>
            )
          ) : (
            <div className="space-y-3">
              <SchemaViewer schema={schemaForStatus} />
              {responseExamples.length > 0 && (
                <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                    Examples
                  </p>
                  <div className="mt-2 space-y-2">
                    {responseExamples.map((example) => (
                      <div key={example.name}>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                          {example.name}
                        </p>
                        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 normal-case">
                          <CodeMirror
                            value={example.value}
                            height="140px"
                            theme={store.darkMode ? githubDark : githubLight}
                            extensions={[json5()]}
                            editable={false}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }
);

export default ResponseSection;
