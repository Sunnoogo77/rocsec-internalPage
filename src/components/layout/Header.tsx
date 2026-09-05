import { ExternalLink, LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import styles from "./Layout.module.css";

export function Header() {
  const { user, logout } = useAuth();
  const initiales = user
    ? `${user.first_name?.[0] ?? user.email[0]}${user.last_name?.[0] ?? ""}`.toUpperCase()
    : "??";

  return (
    <header className={styles.header}>
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
        {user ? (
          <>
            <span className={styles.userPill} title={user.email}>
              <span className={styles.avatar}>{initiales}</span>
              <span>{user.email}</span>
            </span>
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
