export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
      <div>
        <h1
          className="font-display font-bold text-3xl tracking-tight text-foreground"
          data-testid="page-title"
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
