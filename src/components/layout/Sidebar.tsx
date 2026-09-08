import { useAuth } from "@/auth/AuthContext";
import { NavLink } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  CalendarDays,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Music,
  Quote,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import styles from "./Layout.module.css";

interface NavLinkSpec {
  to: string;
  label: string;
  icon: ReactNode;
  count?: number;
}

interface SidebarProps {
  modCount?: number;
  onNavigate?: () => void;
}

export function Sidebar({ modCount = 0, onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const items: { section: string; links: NavLinkSpec[] }[] = [
    {
      section: "Vue d'ensemble",
      links: [
        { to: "/", label: "Tableau de bord", icon: <LayoutDashboard className={styles.navIcon} /> },
      ],
    },
    {
      section: "Contenu",
      links: [
        { to: "/sermons", label: "Cultes", icon: <BookOpen className={styles.navIcon} /> },
        { to: "/cantiques", label: "Cantiques", icon: <Music className={styles.navIcon} /> },
        { to: "/annonces", label: "Annonces", icon: <Megaphone className={styles.navIcon} /> },
        {
          to: "/temoignages",
          label: "Témoignages",
          icon: <MessageSquare className={styles.navIcon} />,
          count: modCount,
        },
      ],
    },
    {
      section: "Hebdomadaire",
      links: [
        {
          to: "/cette-semaine",
          label: "Cette semaine",
          icon: <Calendar className={styles.navIcon} />,
        },
        { to: "/nehemie", label: "Néhémie", icon: <CalendarDays className={styles.navIcon} /> },
        {
          to: "/mot-du-pasteur",
          label: "Mot du pasteur",
          icon: <Quote className={styles.navIcon} />,
        },
      ],
    },
    {
      section: "Bibliothèque",
      links: [
        { to: "/personnes", label: "Personnes", icon: <Users className={styles.navIcon} /> },
        { to: "/medias", label: "Médiathèque", icon: <ImageIcon className={styles.navIcon} /> },
      ],
    },
    {
      section: "Réglages",
      links: [
        ...(user?.is_superuser
          ? [
              {
                to: "/comptes",
                label: "Équipe et accès",
                icon: <Users className={styles.navIcon} />,
              },
            ]
          : []),
        { to: "/reglages", label: "Réglages", icon: <Settings className={styles.navIcon} /> },
      ],
    },
  ];

  return (
    <nav className={styles.sidebar} aria-label="Navigation principale">
      {items.map((group) => (
        <div key={group.section}>
          <div className={styles.sideSection}>{group.section}</div>
          {group.links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              end={link.to === "/"}
              className={({ isActive }) =>
                [styles.nav, isActive ? styles.navActive : ""].filter(Boolean).join(" ")
              }
            >
              {link.icon}
              <span>{link.label}</span>
              {link.count && link.count > 0 ? (
                <span className={styles.navCount}>{link.count}</span>
              ) : null}
            </NavLink>
          ))}
        </div>
      ))}
      <div className={styles.sideFoot}>
        <span>Roc Séculaire · Espace interne</span>
      </div>
    </nav>
  );
}
