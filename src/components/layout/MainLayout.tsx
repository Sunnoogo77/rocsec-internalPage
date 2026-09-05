import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import styles from "./Layout.module.css";

export function MainLayout() {
  return (
    <div className={styles.shell}>
      <Header />
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

interface PageHeadProps {
  title: string;
  lede?: string;
  actions?: React.ReactNode;
}

export function PageHead({ title, lede, actions }: PageHeadProps) {
  return (
    <header className={styles.pageHead}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {lede ? <p className={styles.pageLede}>{lede}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}
