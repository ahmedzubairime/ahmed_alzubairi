import type { ReactNode } from "react";
import {
  ArticleCard,
  CourseCard,
  FilterChips,
  MediaCard,
  Pagination,
  ResourceCard,
  SearchField,
  ShareButtons,
  VideoEmbed,
} from "@/components/public/listing";
import { Button, ButtonLink, SectionHeading } from "@/components/ui";
import { COVERS, SAMPLE_EMBED, type ListingText } from "./listing-content";

const PATH = "/ui-kit";

function Block({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="space-y-5 border-t border-text/10 pt-8">
      <SectionHeading title={title} intro={intro} />
      {children}
    </section>
  );
}

/** A label above each sample state, so the screenshots read on their own. */
function State({ children }: { children: ReactNode }) {
  return <div className="space-y-2 rounded-lg border border-dashed border-text/20 p-4">{children}</div>;
}

/**
 * The listing components (P5A-T02) in their states. A server component: the
 * cards read their labels on the server, and only the copy button is a client
 * island.
 */
export function ListingDemo({ text: t }: { text: ListingText }) {
  const date = "2026-10-21T09:00:00Z";

  return (
    <div className="space-y-10">
      <SectionHeading title={t.title} intro={t.intro} />

      <Block title={t.search} intro={t.searchIntro}>
        <State>
          <SearchField pathname={PATH} label={t.searchArticles} />
        </State>
        <State>
          <SearchField pathname={PATH} value={t.searchValue} query={{ category: "governance", page: "3" }} />
        </State>
      </Block>

      <Block title={t.filters} intro={t.filtersIntro}>
        <State>
          <FilterChips label={t.filterCategory} pathname={PATH} param="category" options={t.categories} />
        </State>
        <State>
          <FilterChips
            label={t.filterKind}
            pathname={PATH}
            param="kind"
            options={t.kinds}
            query={{ kind: "template", q: "risk", page: "2" }}
          />
        </State>
      </Block>

      <Block title={t.pagination} intro={t.paginationIntro}>
        <State>
          <Pagination pathname={PATH} page={1} totalPages={9} />
        </State>
        <State>
          <Pagination pathname={PATH} page={5} totalPages={9} query={{ category: "governance" }} />
        </State>
        <State>
          <Pagination pathname={PATH} page={9} totalPages={9} />
        </State>
      </Block>

      <Block title={t.articles} intro={t.articlesIntro}>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <li className="flex">
            <ArticleCard
              className="w-full"
              headingLevel={3}
              href={PATH}
              title={t.article1}
              excerpt={t.excerpt1}
              category={t.categories[0].label}
              cover={{ src: COVERS[0], alt: t.coverAlt }}
              publishedAt={date}
              readingMinutes={7}
            />
          </li>
          <li className="flex">
            <ArticleCard
              className="w-full"
              headingLevel={3}
              href={PATH}
              title={t.article2}
              excerpt={t.excerpt2}
              category={t.categories[4].label}
              cover={null}
              publishedAt="2026-09-03T00:00:00Z"
              readingMinutes={1}
            />
          </li>
          <li className="flex">
            <ArticleCard
              className="w-full"
              headingLevel={3}
              href={PATH}
              title={t.article3}
              excerpt={t.excerpt3}
              category={null}
              cover={{ src: COVERS[2], alt: t.coverAlt }}
              publishedAt="2026-06-15T00:00:00Z"
              readingMinutes={12}
            />
          </li>
        </ul>
      </Block>

      <Block title={t.share} intro={t.shareIntro}>
        <State>
          <ShareButtons url="https://example.org/blog/sample-article" title={t.shareTitle} />
        </State>
      </Block>

      <Block title={t.resources} intro={t.resourcesIntro}>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <li className="flex">
            <ResourceCard
              className="w-full"
              headingLevel={3}
              kind="template"
              fileType="excel"
              title={t.resource1}
              description={t.resourceText1}
              action={<Button size="sm">{t.download}</Button>}
            />
          </li>
          <li className="flex">
            <ResourceCard
              className="w-full"
              headingLevel={3}
              kind="guide"
              fileType="pdf"
              title={t.resource2}
              description={t.resourceText2}
              action={
                <Button size="sm" variant="secondary">
                  {t.getByEmail}
                </Button>
              }
            />
          </li>
          <li className="flex">
            <ResourceCard
              className="w-full"
              headingLevel={3}
              kind="working_paper"
              fileType={null}
              title={t.resource3}
              description={t.resourceText3}
              action={<Button size="sm">{t.download}</Button>}
            />
          </li>
        </ul>
      </Block>

      <Block title={t.media} intro={t.mediaIntro}>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <li className="flex">
            <MediaCard
              className="w-full"
              headingLevel={3}
              category="media"
              title={t.media1}
              outlet={t.outlet1}
              date={date}
              image={{ src: COVERS[1], alt: t.coverAlt }}
              action={
                <ButtonLink href={PATH} size="sm" variant="secondary">
                  {t.viewItem}
                </ButtonLink>
              }
            />
          </li>
          <li className="flex">
            <MediaCard
              className="w-full"
              headingLevel={3}
              category="conferences"
              title={t.media2}
              outlet={t.outlet2}
              date="2026-05-11T00:00:00Z"
              image={null}
              media={<VideoEmbed src={SAMPLE_EMBED} title={t.videoTitle} />}
            />
          </li>
          <li className="flex">
            <MediaCard
              className="w-full"
              headingLevel={3}
              category="events"
              title={t.media3}
              outlet={t.outlet3}
              date={null}
              image={null}
            />
          </li>
        </ul>
      </Block>

      <Block title={t.courses} intro={t.coursesIntro}>
        <ul className="grid gap-6 md:grid-cols-2">
          <li className="flex">
            <CourseCard
              className="w-full"
              headingLevel={3}
              href={PATH}
              type="in_person"
              title={t.course1}
              description={t.courseText1}
              startsAt="2027-01-12T06:00:00Z"
              place={t.place1}
              seats={{ left: 14, total: 25 }}
              action={<Button className="w-full">{t.register}</Button>}
            />
          </li>
          <li className="flex">
            <CourseCard
              className="w-full"
              headingLevel={3}
              href={PATH}
              type="online_live"
              title={t.course2}
              description={t.courseText2}
              startsAt="2026-12-02T15:00:00Z"
              place={null}
              seats={{ left: 2, total: 30 }}
              action={<Button className="w-full">{t.register}</Button>}
            />
          </li>
          <li className="flex">
            <CourseCard
              className="w-full"
              headingLevel={3}
              href={PATH}
              type="in_person"
              title={t.course3}
              description={t.courseText3}
              startsAt="2026-11-28T07:00:00Z"
              place={t.place3}
              seats={{ left: 0, total: 20 }}
              action={<Button className="w-full">{t.register}</Button>}
            />
          </li>
          <li className="flex">
            <CourseCard
              className="w-full"
              headingLevel={3}
              href={PATH}
              type="recorded"
              title={t.course4}
              description={t.courseText4}
              startsAt={null}
              place={null}
              seats={null}
              action={<Button className="w-full">{t.register}</Button>}
            />
          </li>
        </ul>
      </Block>
    </div>
  );
}
