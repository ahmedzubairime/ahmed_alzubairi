import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { CopyLinkButton } from "./copy-link-button";
import { FacebookIcon, LinkedInIcon, MailIcon, WhatsAppIcon, XIcon } from "./icons";
import { SHARE_NETWORKS, shareHref, type ShareNetwork } from "./links";

const ICONS: Record<ShareNetwork, ReactNode> = {
  whatsapp: <WhatsAppIcon className="size-5" />,
  x: <XIcon className="size-5" />,
  linkedin: <LinkedInIcon className="size-5" />,
  facebook: <FacebookIcon className="size-5" />,
  email: <MailIcon className="size-5" />,
};

const ROUND =
  "inline-flex size-10 items-center justify-center rounded-full border border-text/20 text-text hover:bg-text/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Copy link, then WhatsApp, X, LinkedIn, Facebook and email. Every network is
 * a plain link to its share page: no network script loads here. `url` is the
 * page's full canonical URL.
 */
export function ShareButtons({ url, title, className }: { url: string; title: string; className?: string }) {
  const t = useTranslations("PublicListing");

  return (
    <div role="group" aria-label={t("shareLabel")} className={cx("flex flex-wrap items-center gap-2", className)}>
      <span aria-hidden="true" className="me-1 text-sm font-semibold text-text-secondary">
        {t("shareLabel")}
      </span>
      <CopyLinkButton
        url={url}
        labels={{ copy: t("copyLink"), copied: t("linkCopied"), failed: t("copyFailed") }}
        className={cx(ROUND, "sm:w-auto sm:gap-2 sm:px-3.5 sm:text-sm sm:font-semibold")}
      />
      <ul className="flex flex-wrap gap-2">
        {SHARE_NETWORKS.map((network) => {
          const external = network !== "email";
          const name = t(`shareNetworks.${network}`);
          return (
            <li key={network}>
              <a
                href={shareHref(network, url, title)}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label={
                  external ? `${t("shareOn", { network: name })} ${t("opensInNewTab")}` : t("shareOn", { network: name })
                }
                title={name}
                className={ROUND}
              >
                {ICONS[network]}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
