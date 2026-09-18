export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className={label ? 'spinner-label' : 'visually-hidden'}>{label ?? 'Загрузка…'}</span>
    </span>
  );
}
