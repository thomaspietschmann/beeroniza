"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Dropdown from "react-bootstrap/Dropdown";
import Row from "react-bootstrap/Row";
import { formatRelativeTime } from "@/components/dashboard/format";
import { PLATFORM_ORDER, SIZE_PRESETS } from "@/lib/presets";
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

const FILTER_OWN = "__own__";

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

interface FormatGroup {
  key: string;
  label: string;
  width: number;
  height: number;
  platforms: string[];
  items: TemplateListItem[];
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
          {tpl.formatLabel && (
            <div className={styles.format}>{tpl.formatLabel}</div>
          )}
          <div className={styles.meta}>Updated {formatRelativeTime(tpl.updatedAt)}</div>
        </div>
        <div className={styles.actions}>
          <Button size="sm" variant="primary" className="flex-grow-1" onClick={() => onUse(tpl)}>
            Use this template
          </Button>
          <Dropdown align="end">
            <Dropdown.Toggle size="sm" variant="outline-secondary" className="bnz-no-caret" id={`tpl-menu-${tpl.id}`} aria-label="More actions">
              ···
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item as={Link} href={`/editor/${tpl.id}`}>Edit</Dropdown.Item>
              <Dropdown.Item as={Link} href={`/templates/${tpl.id}`}>Saved usages</Dropdown.Item>
              <Dropdown.Item onClick={() => onApi(tpl)}>API example</Dropdown.Item>
              <Dropdown.Item onClick={() => onDuplicate(tpl)}>Duplicate</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item className="text-danger" onClick={() => onDelete(tpl)}>Delete</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>
    </Col>
  );
}

function FormatSection({
  group,
  onUse,
  onDelete,
  onDuplicate,
  onApi,
}: {
  group: FormatGroup;
  onUse: (tpl: TemplateListItem) => void;
  onDelete: (tpl: TemplateListItem) => void;
  onDuplicate: (tpl: TemplateListItem) => void;
  onApi: (tpl: TemplateListItem) => void;
}) {
  return (
    <section className={styles.formatSection}>
      <div className={styles.formatHeader}>
        <h2 className={styles.formatTitle}>{group.label}</h2>
        <div className={styles.platformBadges}>
          {group.platforms.map((p) => (
            <span key={p} className={styles.platformBadge}>{p}</span>
          ))}
        </div>
      </div>
      <Row className="g-3">
        {group.items.map((tpl) => (
          <TemplateCard key={tpl.id} tpl={tpl} onUse={onUse} onDelete={onDelete} onDuplicate={onDuplicate} onApi={onApi} />
        ))}
      </Row>
    </section>
  );
}

function OwnSection({
  items,
  onUse,
  onDelete,
  onDuplicate,
  onApi,
}: {
  items: TemplateListItem[];
  onUse: (tpl: TemplateListItem) => void;
  onDelete: (tpl: TemplateListItem) => void;
  onDuplicate: (tpl: TemplateListItem) => void;
  onApi: (tpl: TemplateListItem) => void;
}) {
  return (
    <section className={styles.formatSection}>
      <div className={styles.formatHeader}>
        <h2 className={styles.formatTitle}>Custom Templates</h2>
        <span className={styles.ownHint}>Custom size, no standard preset</span>
      </div>
      <Row className="g-3">
        {items.map((tpl) => (
          <TemplateCard key={tpl.id} tpl={tpl} onUse={onUse} onDelete={onDelete} onDuplicate={onDuplicate} onApi={onApi} />
        ))}
      </Row>
    </section>
  );
}

export function TemplateGrid({ templates }: { templates: TemplateListItem[] }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null);
  const [apiTemplate, setApiTemplate] = useState<TemplateListItem | null>(null);

  const { formatGroups, custom } = useMemo(() => {
    const customTemplates: TemplateListItem[] = [];
    const byDim = new Map<string, TemplateListItem[]>();

    for (const t of templates) {
      if (t.platform === null) {
        customTemplates.push(t);
        continue;
      }
      const key = `${t.width}x${t.height}`;
      const arr = byDim.get(key);
      if (arr) arr.push(t);
      else byDim.set(key, [t]);
    }

    const groups: FormatGroup[] = [];
    const seenDims = new Set<string>();

    for (const preset of SIZE_PRESETS) {
      const key = `${preset.width}x${preset.height}`;
      if (seenDims.has(key)) continue;
      seenDims.add(key);

      const all = byDim.get(key) ?? [];
      if (all.length === 0) continue;

      const platformSet = new Set(all.map((t) => t.platform!));
      const platforms = (PLATFORM_ORDER as readonly string[]).filter((p) => platformSet.has(p));

      // Sort by platform order first, then variant — ensures canonical platform is
      // preferred when deduplicating by variant name.
      const sorted = [...all].sort((a, b) => {
        const pa = (PLATFORM_ORDER as readonly string[]).indexOf(a.platform ?? "");
        const pb = (PLATFORM_ORDER as readonly string[]).indexOf(b.platform ?? "");
        return pa !== pb ? pa - pb : variantRank(a.name) - variantRank(b.name);
      });

      const seenNames = new Set<string>();
      const items: TemplateListItem[] = [];
      for (const t of sorted) {
        if (!seenNames.has(t.name)) {
          seenNames.add(t.name);
          items.push(t);
        }
      }
      items.sort((a, b) => variantRank(a.name) - variantRank(b.name));

      groups.push({ key, label: preset.label, width: preset.width, height: preset.height, platforms, items });
    }

    // Templates with platform set but dimensions not in SIZE_PRESETS (unusual, but possible).
    for (const [key, all] of byDim.entries()) {
      if (seenDims.has(key)) continue;
      const [w, h] = key.split("x").map(Number);
      const platformSet = new Set(all.map((t) => t.platform!));
      const platforms = [...platformSet].sort();
      groups.push({
        key,
        label: `${w}×${h}`,
        width: w,
        height: h,
        platforms,
        items: [...all].sort((a, b) => variantRank(a.name) - variantRank(b.name)),
      });
    }

    return { formatGroups: groups, custom: customTemplates };
  }, [templates]);

  const visibleFormatGroups =
    activeFilter === "all"
      ? formatGroups
      : activeFilter === FILTER_OWN
        ? []
        : formatGroups.filter((g) => g.key === activeFilter);

  const showCustomSection = activeFilter === "all" || activeFilter === FILTER_OWN;

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
    const ok = window.confirm(`Delete "${tpl.name}"? This cannot be undone.`);
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

  const handlers = {
    onUse: (tpl: TemplateListItem) => setUsingTemplateId(tpl.id),
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
    onApi: (tpl: TemplateListItem) => setApiTemplate(tpl),
  };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h1 className="h3 mb-1">Templates</h1>
          <p className="text-secondary mb-0">
            Filter by format — duplicate sizes are merged, compatible platforms shown inline.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          New template
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

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
          <div className={styles.filters} role="group" aria-label="Filter by format">
            <button
              type="button"
              className={`${styles.chip}${activeFilter === "all" ? ` ${styles.chipActive}` : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              All
              <span className={styles.chipCount}>{templates.length}</span>
            </button>
            {formatGroups.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`${styles.chip}${activeFilter === g.key ? ` ${styles.chipActive}` : ""}`}
                onClick={() => setActiveFilter(g.key)}
              >
                {g.label}
                <span className={styles.chipCount}>{g.items.length}</span>
              </button>
            ))}
            {custom.length > 0 && (
              <button
                type="button"
                className={`${styles.chip}${activeFilter === FILTER_OWN ? ` ${styles.chipActive}` : ""}`}
                onClick={() => setActiveFilter(FILTER_OWN)}
              >
                Custom
                <span className={styles.chipCount}>{custom.length}</span>
              </button>
            )}
          </div>

          {visibleFormatGroups.map((g) => (
            <FormatSection key={g.key} group={g} {...handlers} />
          ))}

          {showCustomSection && custom.length > 0 && (
            <OwnSection items={custom} {...handlers} />
          )}
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
