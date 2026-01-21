import { useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import type { ApiListItem } from '../../types';
import MethodBadge from '../ui/MethodBadge';
import { useApiStore } from '../../store/api/ApiStoreContext';

type ApiListSectionProps = {
  isStacked?: boolean;
};

type ApiListSectionViewProps = {
  isStacked: boolean;
  apiList: ApiListItem[];
  groupedApis: Array<[string, ApiListItem[]]>;
  openControllers: Record<string, boolean>;
  selectedKey: string | null;
  onToggleController: (controller: string) => void;
  onSelectKey: (key: string) => void;
};

const ApiListSectionView = observer(
  ({
    isStacked,
    apiList,
    groupedApis,
    openControllers,
    selectedKey,
    onToggleController,
    onSelectKey,
  }: ApiListSectionViewProps) => {
    return (
      <section
        className={`flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm ${isStacked ? '' : 'min-h-0'}`}
      >
        <div className="border-b border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            API List
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {apiList.length} endpoints
          </p>
        </div>
        <div className={`flex-1 ${isStacked ? '' : 'min-h-0 overflow-y-auto'}`}>
          {groupedApis.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {groupedApis.map(([controller, apiItems]) => {
                const isOpen = openControllers[controller] ?? false;
                return (
                  <li key={controller}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between border-b border-slate-100 dark:border-slate-700 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      onClick={() => onToggleController(controller)}
                    >
                      <span>{controller}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {isOpen ? 'Hide' : 'Show'}
                      </span>
                    </button>
                    {isOpen && (
                      <ul>
                        {apiItems.map((item) => (
                          <li key={item.key}>
                            <button
                              type="button"
                              className={`flex w-full items-center gap-2 border-t border-slate-100 dark:border-slate-700 px-4 py-3 text-left ${
                                selectedKey === item.key
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                              }`}
                              onClick={() => onSelectKey(item.key)}
                            >
                              <MethodBadge method={item.method} />
                              <span className="flex-1">
                                <span className="block truncate text-sm">
                                  {item.path}
                                </span>
                                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                  {item.summary || '-'}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex items-center justify-center p-8 text-slate-500 dark:text-slate-400">
              No APIs available
            </div>
          )}
        </div>
      </section>
    );
  }
);

const ApiListSection = observer(({ isStacked = false }: ApiListSectionProps) => {
  const store = useApiStore();

  const groupedApis = useMemo(() => {
    const map = new Map<string, ApiListItem[]>();
    store.apiList.forEach((item) => {
      const key = item.controller ?? 'General';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(item);
    });
    return Array.from(map.entries());
  }, [store.apiList]);

  const handleToggleController = useCallback(
    (controller: string) => store.toggleController(controller),
    [store]
  );

  const handleSelectKey = useCallback(
    (key: string) => store.setSelectedKey(key),
    [store]
  );

  return (
    <ApiListSectionView
      isStacked={isStacked}
      apiList={store.apiList}
      groupedApis={groupedApis}
      openControllers={store.openControllers}
      selectedKey={store.selectedKey}
      onToggleController={handleToggleController}
      onSelectKey={handleSelectKey}
    />
  );
});

export default ApiListSection;
