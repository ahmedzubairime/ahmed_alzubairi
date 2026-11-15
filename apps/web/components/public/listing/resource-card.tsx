import type { ResourceKind } from "@repo/shared";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { FileIcon } from "./icons";
import { Heading, LISTING_CARD } from "./parts";

export type ResourceFileType = "pdf" | "word" | "excel";

/** The file's format, as a small tag. The name is a product name, so it reads the same in both languages. */
export function FileTypeBadge({ type, className }: { type: ResourceFileType; className?: string }) {
  const t = useTranslations("PublicListing");
  const name = t(`fileType.${type}`);

  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-sm bg-text/10 px-2 text-xs font-semibold text-text",
        className,
      )}
    >
      <FileIcon className="size-3.5" />
      <span className="sr-only">{t("fileTypeLabel", { type: name })}</span>
      <span aria-hidden="true" dir="ltr">
        {name}
      </span>
    </span>
  );
}

/**
 * A free resource (§6.9). `action` is the page's download button or email
 * gate trigger: this card doesn't know how the file is reached.
 */
export function ResourceCard({
  kind,
  fileType,
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: {
  kind: ResourceKind;
  fileType: ResourceFileType | null;
  title: string;
  description: string | null;
  action: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const t = useTranslations("PublicListing");

  return (
    <article className={cx(LISTING_CARD, "p-5", className)}>
      {/* Gold as a divider (§13): a short bar that marks the card's top. */}
      <span aria-hidden="true" className="mb-4 block h-0.5 w-10 rounded-full bg-accent" />
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t(`resourceKind.${kind}`)}</Badge>
        {fileType && <FileTypeBadge type={fileType} />}
      </div>
      <Heading level={headingLevel} className="mt-3 text-xl leading-snug">
        {title}
      </Heading>
      {description && <p className="mt-2 line-clamp-4 text-pretty text-text-secondary">{description}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-5">{action}</div>
    </article>
  );
}
