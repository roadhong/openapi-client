type MethodBadgeProps = {
  method: string;
  className?: string;
};

const methodBadgeClass = (method: string) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'POST':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'PUT':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'PATCH':
      return 'border-purple-200 bg-purple-50 text-purple-700';
    case 'DELETE':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
};

const MethodBadge = ({ method, className = '' }: MethodBadgeProps) => (
  <span
    className={[
      'inline-flex w-14 items-center justify-center rounded border px-2 py-0.5 text-xs font-semibold uppercase',
      methodBadgeClass(method),
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {method}
  </span>
);

export default MethodBadge;
