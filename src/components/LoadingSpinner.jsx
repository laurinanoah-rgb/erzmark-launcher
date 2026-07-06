export default function LoadingSpinner({ label }) {
  return (
    <div className="erzmark-loading">
      <div className="erzmark-logo" />
      <div className="erzmark-spinner" />
      {label && <p className="erzmark-loading-label">{label}</p>}
    </div>
  );
}
