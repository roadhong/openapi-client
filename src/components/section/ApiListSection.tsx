import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import type { ApiListItem } from '../../types';
import MethodBadge from '../others/MethodBadge';
import { useApiStore } from '../../store/ApiStore';

type ApiListSectionProps = {
  isStacked?: boolean;
};

const ApiListSection = observer(({ isStacked = false }: ApiListSectionProps) => {
  const store = useApiStore();
  const apiList = store.apiList;
  const selectedKey = store.selectedKey;
  const openControllers = store.openControllers;

  // Create grouped API list
  const groupedApis = useMemo(() => {
    const map = new Map<string, ApiListItem[]>();
    apiList.forEach((item) => {
      const key = item.controller ?? 'General';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(item);
    });
    return Array.from(map.entries());
  }, [apiList]);

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
                    onClick={() => store.toggleController(controller)}
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
                            onClick={() => store.setSelectedKey(item.key)}
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
});

export default ApiListSection;
