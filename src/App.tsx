import { useEffect, useState } from 'react';
import Split from 'react-split';
import ApiListSection from './components/sections/ApiListSection';
import HeaderDialog from './components/dialogs/HeaderDialog';
import GlobalAuthorizeDialog from './components/dialogs/GlobalAuthorizeDialog';
import ServersDialog from './components/dialogs/ServersDialog';
import SourceDialog from './components/dialogs/SourceDialog';
import InfoDialog from './components/dialogs/InfoDialog';
import RequestSection from './components/sections/RequestSection';
import ResponseSection from './components/sections/ResponseSection';
import { useApiStore } from './store/api/ApiStoreContext';
import Header from './components/layout/Header';

const App = () => {
  const store = useApiStore();

  const [isStacked, setIsStacked] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Process initial load asynchronously to prevent UI blocking
    const initLoad = async () => {
      try {
        await Promise.all([store.persistReady, store.loadMetadata()]);
        store.ensureSelectedApi();
        // Rendering ready
        setIsReady(true);
      } catch (error) {
        setIsReady(true); // Allow rendering even if error occurs
      }
    };
    initLoad();
  }, [store]);

  useEffect(() => {
    const stackBreakpoint = 1024;
    const media = window.matchMedia(`(max-width: ${stackBreakpoint}px)`);
    const handleChange = () => setIsStacked(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isStacked ? 'auto' : 'hidden';
    return () => {
      document.body.style.overflow = 'hidden';
    };
  }, [isStacked]);

  // Show full loading screen only when initial load is not completed
  // Show header during metadata loading to display header's loading UI
  if (!isReady) {
    return (
      <div className="flex flex-col bg-slate-100 text-slate-900 h-screen">
        <Header />
        <div className="flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-4">
            <div className="text-slate-600 text-lg">Loading...</div>
            {store.isLoadingMetadata && (
              <div className="text-slate-400 text-sm">Fetching metadata...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${isStacked ? 'min-h-screen' : 'h-screen'}`}
    >
      <Header />
      <main className={`p-4 ${isStacked ? 'space-y-4' : 'flex-1 min-h-0'}`}>
        {isStacked ? (
          <div className="flex flex-col gap-4">
            <ApiListSection isStacked={true} />
            <RequestSection isStacked={true} />
            <ResponseSection isStacked={true} />
          </div>
        ) : (
          <Split
            className="split h-full"
            sizes={[20, 40, 40]}
            minSize={[200, 320, 320]}
            gutterSize={8}
            snapOffset={0}
            expandToMin={false}
            direction="horizontal"
            style={{ flexDirection: 'row' }}
          >
            <ApiListSection />
            <RequestSection />
            <ResponseSection />
          </Split>
        )}
      </main>
      <HeaderDialog />
      <GlobalAuthorizeDialog />
      <SourceDialog />
      <ServersDialog />
      <InfoDialog />
    </div>
  );
};

export default App;
