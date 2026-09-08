import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import styles from "./Layout.module.css";

export interface Crumb {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: Crumb[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Fil d'Ariane" className={styles.crumb}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <Fragment key={`${item.label}-${idx}`}>
            {idx > 0 ? (
              <ChevronRight className={styles.crumbSep} size={12} aria-hidden />
            ) : null}
            {isLast || !item.to ? (
              <span className={isLast ? styles.crumbCurrent : ""}>{item.label}</span>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
