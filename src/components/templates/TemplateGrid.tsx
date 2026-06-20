"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { formatRelativeTime } from "@/components/dashboard/format";
import { PLATFORM_ORDER } from "@/lib/presets";
import { apiMutate } from "@/lib/api-client";
import { NewTemplateModal } from "./NewTemplateModal";
import { TemplateThumb } from "./TemplateThumb";
import { NewUsageModal } from "@/components/usages/NewUsageModal";
import { ApiExampleModal } from "@/components/generate/ApiExampleModal";
import styles from "./template-grid.module.scss";

export interface TemplateListItem {
  id: string;
  name: string;
  platform: string | null;
  formatLabel: string | null;
  width: number;
  height: number;
  updatedAt: string;
  createdAt: string;
}

const INDIVIDUAL = "Individuell";

// Logical order for the 8 content variants within a format.
const VARIANT_ORDER = [
  "Title",
  "Title + 1 avatar",
  "Title + 2 avatars",
  "Title + 3 avatars",
  "Title + subtitle",
  "Title + subtitle + 1 avatar",
  "Title + subtitle + 2 avatars",
  "Title + subtitle + 3 avatars",
];

function variantRank(name: string): number {
  const i = VARIANT_ORDER.indexOf(name);
  return i === -1 ? VARIANT_ORDER.length : i;
}

function TemplateCard({
  tpl,
  onUse,
  onDelete,
  onDuplicate,
  onApi,
}: {
  tpl: TemplateListItem;
  onUse: (tpl: TemplateListItem) => void;
  onDelete: (tpl: TemplateListItem) => void;
  onDuplicate: (tpl: TemplateListItem) => void;
  onApi: (tpl: TemplateListItem) => void;
}) {
  return (
    <Col xs={12} sm={6} lg={4} xxl={3}>
      <div className={`bnz-card ${styles.card}`}>
        <Link href={`/editor/${tpl.id}`} className={styles.preview} aria-label={`Edit ${tpl.name}`}>
          <TemplateThumb id={tpl.id} updatedAt={tpl.updatedAt} width={tpl.width} height={tpl.height} />
        </Link>
        <div className={styles.body}>
          <div className={styles.name} title={tpl.name}>
            {tpl.name}
          </div>
          <div className={styles.format}>
            {tpl.formatLabel || `${tpl.width}×${tpl.height}`}
          </div>
          <div className={styles.meta}>Updated {formatRelativeTime(tpl.updatedAt)}</div>
        </div>
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="primary"
            className="flex-grow-1"
            onClick={() => onUse(tpl)}
          >
            Use this template
          </Button>
          <Link href={`/editor/${tpl.id}`} className="btn btn-sm btn-outline-dark">
            Edit
          </Link>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => onApi(tpl)}
            aria-label={`API example for ${tpl.name}`}
          >
            API
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => onDuplicate(tpl)}
            aria-label={`Duplicate ${tpl.name}`}
          >
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => onDelete(tpl)}
            aria-label={`Delete ${tpl.name}`}
          >
            Delete
          </Button>
        </div>
        <div className={styles.subActions}>
          <Link href={`/templates/${tpl.id}`} className="text-decoration-none small">
            Saved usages →
          </Link>
        </div>
      </div>
    </Col>
  );
}

interface PlatformGroup {
  platform: string;
  items: TemplateListItem[];
}

export function TemplateGrid({ templates }: { templates: TemplateListItem[] }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string>("all");
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null);
  const [apiTemplate, setApiTemplate] = useState<TemplateListItem | null>(null);

  // Group templates by platform (null → "Individuell"), in a stable order.
  const groups = useMemo<PlatformGroup[]>(() => {
    const byPlatform = new Map<string, TemplateListItem[]>();
    for (const t of templates) {
      const key = t.platform ?? INDIVIDUAL;
      const arr = byPlatform.get(key);
      if (arr) arr.push(t);
      else byPlatform.set(key, [t]);
    }
    const known = PLATFORM_ORDER as readonly string[];
    const ordered = [
      ...known,
      ...[...byPlatform.keys()].filter((k) => k !== INDIVIDUAL && !known.includes(k)).sort(),
    ];
    const result: PlatformGroup[] = ordered
      .filter((k) => byPlatform.has(k))
      .map((k) => ({ platform: k, items: byPlatform.get(k)! }));
    if (byPlatform.has(INDIVIDUAL)) {
      result.push({ platform: INDIVIDUAL, items: byPlatform.get(INDIVIDUAL)! });
    }
    return result;
  }, [templates]);

  const visibleGroups = activePlatform === "all" ? groups : groups.filter((g) => g.platform === activePlatform);

  async function handleDuplicate(tpl: TemplateListItem) {
    setError(null);
    try {
      await apiMutate(`/api/templates/${tpl.id}/duplicate`, "POST", undefined, "Failed to duplicate template.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleDelete(tpl: TemplateListItem) {
    if (deletingId) return;
    const ok = window.confirm(`Delete “${tpl.name}”? This cannot be undone.`);
    if (!ok) return;
    setError(null);
    setDeletingId(tpl.id);
    try {
      await apiMutate(`/api/templates/${tpl.id}`, "DELETE", undefined, "Failed to delete template.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h1 className="h3 mb-1">Templates</h1>
          <p className="text-secondary mb-0">Organised by platform — pick a format or create your own.</p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          New template
        </Button>
      </div>

      {error && (
        <Alert variant="danger">{error}</Alert>
      )}

      {templates.length === 0 ? (
        <div className="bnz-card text-center py-5 px-3">
          <p className="h6 mb-1">No templates yet</p>
          <p className="text-secondary mb-3">Create your first template to start generating images.</p>
          <Button variant="primary" onClick={() => setShowNew(true)}>
            New template
          </Button>
        </div>
      ) : (
        <>
          {/* Platform filter */}
          <div className={styles.filters} role="group" aria-label="Filter by platform">
            <button
              type="button"
              className={`${styles.chip}${activePlatform === "all" ? ` ${styles.chipActive}` : ""}`}
              onClick={() => setActivePlatform("all")}
            >
              All
              <span className={styles.chipCount}>{templates.length}</span>
            </button>
            {groups.map((g) => (
              <button
                key={g.platform}
                type="button"
                className={`${styles.chip}${activePlatform === g.platform ? ` ${styles.chipActive}` : ""}`}
                onClick={() => setActivePlatform(g.platform)}
              >
                {g.platform}
                <span className={styles.chipCount}>{g.items.length}</span>
              </button>
            ))}
          </div>

          {visibleGroups.map((g) => (
            <PlatformSection
              key={g.platform}
              group={g}
              onUse={(tpl) => setUsingTemplateId(tpl.id)}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onApi={(tpl) => setApiTemplate(tpl)}
            />
          ))}
        </>
      )}

      <NewTemplateModal show={showNew} onHide={() => setShowNew(false)} />
      <NewUsageModal
        templateId={usingTemplateId ?? ""}
        show={usingTemplateId !== null}
        onHide={() => setUsingTemplateId(null)}
      />
      <ApiExampleModal
        templateId={apiTemplate?.id ?? ""}
        templateName={apiTemplate?.name ?? ""}
        show={apiTemplate !== null}
        onHide={() => setApiTemplate(null)}
      />
    </div>
  );
}

function PlatformSection({
  group,
  onUse,
  onDelete,
  onDuplicate,
  onApi,
}: {
  group: PlatformGroup;
  onUse: (tpl: TemplateListItem) => void;
  onDelete: (tpl: TemplateListItem) => void;
  onDuplicate: (tpl: TemplateListItem) => void;
  onApi: (tpl: TemplateListItem) => void;
}) {
  // Within a platform, group by format label; "Individuell" stays flat.
  const formats = useMemo(() => {
    if (group.platform === INDIVIDUAL) {
      return [{ label: null as string | null, items: [...group.items] }];
    }
    const byFormat = new Map<string, TemplateListItem[]>();
    for (const t of group.items) {
      const key = t.formatLabel ?? "Other";
      const arr = byFormat.get(key);
      if (arr) arr.push(t);
      else byFormat.set(key, [t]);
    }
    return [...byFormat.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, items]) => ({
        label,
        items: items.sort((x, y) => variantRank(x.name) - variantRank(y.name)),
      }));
  }, [group]);

  return (
    <section className={styles.platformSection}>
      <h2 className={styles.platformTitle}>{group.platform}</h2>
      {formats.map((f) => (
        <div key={f.label ?? "__flat__"} className={styles.formatBlock}>
          {f.label && <h3 className={styles.formatTitle}>{f.label}</h3>}
          <Row className="g-3">
            {f.items.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                onUse={onUse}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onApi={onApi}
              />
            ))}
          </Row>
        </div>
      ))}
    </section>
  );
}
