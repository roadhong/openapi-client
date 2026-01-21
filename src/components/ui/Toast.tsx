import { observer } from 'mobx-react-lite';
import { toastStore } from '../../store/toast/ToastStore';

const Toast = observer(() => {
  if (toastStore.toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex max-w-sm flex-col-reverse gap-3">
      {toastStore.toasts.map((toast) => {
        const tone =
          toast.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-700'
            : toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-700';
        const motion =
          toast.state === 'leave'
            ? 'animate-[toast-out_240ms_ease-in_forwards]'
            : 'animate-[toast-in_240ms_ease-out_forwards]';
        return (
          <div
            key={toast.id}
            className={`rounded-md border px-5 py-4 text-base shadow-lg ${tone} ${motion}`}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
});

export default Toast;
