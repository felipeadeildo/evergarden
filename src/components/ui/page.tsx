import type { ReactNode } from "react";

/** Every library page uses this frame, so moving between pages never shifts the text column. */
export function Page({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <aside className="page-aside">{aside}</aside>
      <main id="main" className="page-main">
        {children}
      </main>
      <div className="page-margin" aria-hidden="true" />
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {children}
    </header>
  );
}
