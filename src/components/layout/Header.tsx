import { Link } from "react-router-dom";
import { ThemeControl } from "./ThemeControl";
import { ExternalLink, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import styles from "./Layout.module.css";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const initiales = user
    ? `${user.first_name?.[0] ?? user.email[0]}${user.last_name?.[0] ?? ""}`.toUpperCase()
    : "??";

  return (
    <header className={styles.header}>
      <button
        type="button"
        onClick={onMenu}
        className={`${styles.iconBtn} ${styles.menuButton}`}
        aria-label="Ouvrir la navigation"
      >
        <Menu size={21} />
      </button>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden>
          R
        </span>
        <span>Roc Séculaire</span>
        <span className={styles.brandTag}>Équipe</span>
      </div>
      <div className={styles.spacer} />
      <div className={styles.headerActions}>
        <a
          className={styles.iconBtn}
          href={import.meta.env.VITE_PUBLIC_SITE_URL || "/"}
          target="_blank"
          rel="noopener noreferrer"
          title="Voir le site public"
          aria-label="Voir le site public"
        >
          <ExternalLink size={16} />
        </a>
        <ThemeControl />
        {user ? (
          <>
            <Link
              to="/reglages"
              className={styles.userPill}
              title={user.email}
              aria-label="Mon compte"
            >
              <span className={styles.avatar}>{initiales}</span>
              <span>{user.email}</span>
            </Link>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => logout()}
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
