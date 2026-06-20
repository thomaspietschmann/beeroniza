import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime } from "./format";
import styles from "./recent-generations.module.scss";

export interface RecentGenerationItem {
  id: string;
  status: string;
  imageUrl: string | null;
  templateName: string;
  format: string;
  createdAt: string;
  href: string;
}

export function RecentGenerations({ items }: { items: RecentGenerationItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center text-secondary py-5">
        <p className="mb-1 fw-semibold">No generations yet</p>
        <p className="small mb-0">Open a template and hit “Generate” to create your first image.</p>
      </div>
    );
  }

  return (
    <div>
      {items.map((g) => (
        <Link key={g.id} href={g.href} className={styles.row}>
          {g.imageUrl ? (

            <img src={g.imageUrl} alt={g.templateName} className={styles.thumb} />
          ) : (
            <div className={`${styles.thumb} ${styles.placeholder}`}>{g.format.toUpperCase()}</div>
          )}
          <div className={styles.meta}>
            <div className={styles.name}>{g.templateName}</div>
            <div className={styles.time}>{formatRelativeTime(g.createdAt)}</div>
          </div>
          <StatusBadge status={g.status} />
        </Link>
      ))}
    </div>
  );
}
