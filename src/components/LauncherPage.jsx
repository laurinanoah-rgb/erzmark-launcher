export default function LauncherPage({ title, eyebrow, onClose, children, footer, className = "" }) {
  return (
    <div className="erzmark-page-layer" role="presentation" onMouseDown={onClose}>
      <section className={`erzmark-page ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <span className="erzmark-page-ornament is-top-left" aria-hidden="true" />
        <span className="erzmark-page-ornament is-top-right" aria-hidden="true" />
        <span className="erzmark-page-ornament is-bottom-left" aria-hidden="true" />
        <span className="erzmark-page-ornament is-bottom-right" aria-hidden="true" />
        <header className="erzmark-page-header">
          <div className="erzmark-page-heading">
            {eyebrow && <span className="erzmark-page-eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className="erzmark-page-close" type="button" onClick={onClose} aria-label="Schließen"><span aria-hidden="true">×</span></button>
        </header>
        <div className="erzmark-page-body">{children}</div>
        {footer && <footer className="erzmark-page-footer">{footer}</footer>}
      </section>
    </div>
  );
}
