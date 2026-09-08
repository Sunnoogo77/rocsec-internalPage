import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import styles from "./Layout.module.css";

export function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenu">
        Aller au contenu
      </a>
      <Header onMenu={() => setMenuOpen(true)} />
      <Sidebar />
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Navigation">
        <div className={styles.mobileNav}>
          <Sidebar onNavigate={() => setMenuOpen(false)} />
        </div>
      </Modal>
      <main id="contenu" tabIndex={-1} className={styles.main}>
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
