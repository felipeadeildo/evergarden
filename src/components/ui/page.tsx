import type { ReactNode } from "react";

/**
 * The frame of every library page: a side column, the text column and the margin. Documents,
 * folders, the library and settings all put their content in the same column, so moving between
 * them never shifts the page. The side column holds a document's contents; elsewhere it is empty.
 */
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

/** A page's title, with one line of details under it. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {children}
    </header>
  );
}
