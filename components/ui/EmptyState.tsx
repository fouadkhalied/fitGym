interface EmptyStateProps {
  message: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3 opacity-20">📭</div>
      <p className="text-gray-400 text-sm">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-sm text-white rounded-lg transition-colors"
          style={{ background: "#10b981" }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
