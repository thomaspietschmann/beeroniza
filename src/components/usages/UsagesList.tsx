"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import { formatRelativeTime } from "@/components/dashboard/format";
import { apiMutate } from "@/lib/api-client";
import { NewUsageModal } from "./NewUsageModal";
import styles from "./usages.module.scss";

export interface UsageListItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function UsagesList({
  templateId,
  usages,
}: {
  templateId: string;
  usages: UsageListItem[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(usage: UsageListItem) {
    if (deletingId) return;
    const ok = window.confirm(`Delete usage “${usage.name}”? This cannot be undone.`);
    if (!ok) return;
    setError(null);
    setDeletingId(usage.id);
    try {
      await apiMutate(`/api/usages/${usage.id}`, "DELETE", undefined, "Failed to delete usage.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="bnz-card p-3 p-lg-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h2 className="h5 mb-1">Usages</h2>
          <p className="text-secondary small mb-0">
            Each usage is a saved set of inputs. Fill it in, save, and generate on demand —
            always against the current template.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          New usage
        </Button>
      </div>

      {error && (
        <Alert variant="danger">{error}</Alert>
      )}

      {usages.length === 0 ? (
        <div className={styles.empty}>
          <p className="h6 mb-1">No usages yet</p>
          <p className="text-secondary mb-3">
            Create one to fill in this template and generate images.
          </p>
          <Button variant="primary" onClick={() => setShowNew(true)}>
            New usage
          </Button>
        </div>
      ) : (
        <div className={styles.list}>
          {usages.map((usage) => (
            <div key={usage.id} className={`bnz-card ${styles.row}`}>
              <Link
                href={`/templates/${templateId}/usages/${usage.id}`}
                className={`${styles.rowMain} text-decoration-none`}
              >
                <div className={styles.rowName} title={usage.name}>
                  {usage.name}
                </div>
                <div className={styles.rowMeta}>Updated {formatRelativeTime(usage.updatedAt)}</div>
              </Link>
              <Link
                href={`/templates/${templateId}/usages/${usage.id}`}
                className="btn btn-sm btn-outline-dark"
              >
                Open
              </Link>
              <Button
                size="sm"
                variant="outline-danger"
                disabled={deletingId === usage.id}
                onClick={() => handleDelete(usage)}
                aria-label={`Delete ${usage.name}`}
              >
                {deletingId === usage.id ? "…" : "Delete"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <NewUsageModal templateId={templateId} show={showNew} onHide={() => setShowNew(false)} />
    </div>
  );
}
