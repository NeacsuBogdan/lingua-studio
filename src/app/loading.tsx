export default function Loading() {
  return (
    <div role="status" className="loading-state">
      <span className="skeleton" />
      <span className="skeleton" />
      <p>Loading your workspace…</p>
    </div>
  );
}
