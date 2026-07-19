export function Loading() {
  return <div className="spinner" aria-label="Загрузка" />;
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state">
      <div className="emoji">😕</div>
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {onRetry && (
        <button className="retry-btn" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState({ emoji, title, message }: { emoji: string; title: string; message?: string }) {
  return (
    <div className="state">
      <div className="emoji">{emoji}</div>
      <h2>{title}</h2>
      {message && <p>{message}</p>}
    </div>
  );
}
