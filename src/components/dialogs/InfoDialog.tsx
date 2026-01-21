import { observer } from 'mobx-react-lite';
import { useApiStore } from '../../store/api/ApiStoreContext';
import { getInfo } from '../../types';

type InfoDialogViewProps = {
  open: boolean;
  info: ReturnType<typeof getInfo> | undefined;
  onClose: () => void;
};

const InfoDialogView = observer(({ open, info, onClose }: InfoDialogViewProps) => {
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
            API Information
          </p>
        </div>
        <div className="space-y-4 p-4">
          {info ? (
            <>
              {info.title && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                    Title
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                    {info.title}
                  </p>
                </div>
              )}
              {info.description && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                    Description
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap">
                    {info.description}
                  </p>
                </div>
              )}
              {info.version && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                    Version
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                    {info.version}
                  </p>
                </div>
              )}
              {info.termsOfService && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                    Terms of Service
                  </p>
                  <a
                    href={info.termsOfService}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 block"
                  >
                    {info.termsOfService}
                  </a>
                </div>
              )}
              {info.contact && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                    Contact
                  </p>
                  <div className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                    {info.contact.email && (
                      <p>
                        Email:{' '}
                        <a
                          href={`mailto:${info.contact.email}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {info.contact.email}
                        </a>
                      </p>
                    )}
                    {info.contact.name && <p>Name: {info.contact.name}</p>}
                    {info.contact.url && (
                      <p>
                        URL:{' '}
                        <a
                          href={info.contact.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {info.contact.url}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}
              {info.license && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                    License
                  </p>
                  <div className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                    {info.license.name && (
                      <p>
                        {info.license.url ? (
                          <a
                            href={info.license.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {info.license.name}
                          </a>
                        ) : (
                          info.license.name
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              No information available
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

const InfoDialog = observer(() => {
  const store = useApiStore();
  const info = store.metadata?.spec ? getInfo(store.metadata.spec) : undefined;

  return (
    <InfoDialogView
      open={store.infoDialogOpen}
      info={info}
      onClose={() => store.setInfoDialogOpen(false)}
    />
  );
});

export default InfoDialog;
