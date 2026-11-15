import type { Locale } from "@repo/shared";

// Sample copy for the listing components on the dev-only kit page, like
// content.ts. Made up: no client data.

/** A flat navy-and-gold picture, so the cards show a cover without a remote image. */
function cover(seed: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#0b1f3a"/><circle cx="${40 + seed * 30}" cy="${30 + seed * 8}" r="${26 + seed * 4}" fill="#11274a"/><path d="M0 ${70 - seed * 4} L160 ${50 + seed * 6} L160 90 L0 90Z" fill="#c9a24d" opacity="0.85"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** A stand-in player for the video frame: no third-party request on the kit page. */
export const SAMPLE_EMBED =
  "data:text/html;charset=utf-8," +
  encodeURIComponent(
    '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#0b1f3a;color:#d4b062;font:600 40px sans-serif">&#9654;</body>',
  );

export const COVERS = [cover(0), cover(1), cover(2)];

const ar = {
  title: "مكوّنات صفحات القوائم العامة",
  intro: "للمدونة والموارد والظهور الإعلامي والتدريب. كل مكوّن في حالاته، والنص من الرسائل أو من المحتوى.",
  search: "البحث",
  searchIntro: "نموذج GET يرسل q ويحتفظ بالتصنيف المختار. فارغ، ثم ببحث سابق.",
  searchArticles: "ابحث في المقالات",
  searchValue: "الحوكمة في المنظمات غير الربحية",
  filters: "التصفية",
  filtersIntro: "روابط تضبط معاملًا واحدًا وتعود إلى الصفحة الأولى. تمرَّر أفقيًا على الهاتف.",
  filterCategory: "التصنيف",
  filterKind: "نوع المورد",
  categories: [
    { value: "governance", label: "الحوكمة والامتثال المؤسسي" },
    { value: "management", label: "الإدارة الاستراتيجية" },
    { value: "humanitarian", label: "العمل الإنساني والإغاثي" },
    { value: "development", label: "التنمية المستدامة وبناء القدرات" },
    { value: "monitoring", label: "الرصد والتقييم والمساءلة" },
  ],
  kinds: [
    { value: "guide", label: "أدلة" },
    { value: "template", label: "نماذج" },
    { value: "working_paper", label: "أوراق عمل" },
  ],
  pagination: "ترقيم الصفحات",
  paginationIntro: "الصفحة الأولى، ثم وسط القائمة، ثم الأخيرة. على الهاتف: السابق والتالي ورقم الصفحة.",
  articles: "بطاقات المقالات",
  articlesIntro: "بغلاف وبدونه، وعنوان طويل، ومقتطف يُقص بعد ثلاثة أسطر.",
  article1: "دليل عملي لبناء مجلس أمناء فعّال في المنظمات غير الربحية الناشئة",
  excerpt1:
    "كيف تختار الأعضاء وتوزّع الأدوار وتضع لائحة داخلية تحمي استقلال المنظمة، مع أمثلة من منظمات محلية عملت في بيئات هشة وتحت ضغط تمويلي متغيّر.",
  article2: "المساءلة أمام المجتمعات المتأثرة",
  excerpt2: "خمس ممارسات تجعل آليات الشكاوى والملاحظات جزءًا من دورة المشروع لا إجراءً شكليًا.",
  article3: "من الإغاثة إلى التعافي: متى تبدأ التنمية؟",
  excerpt3:
    "قراءة في تجارب الانتقال من الاستجابة الطارئة إلى برامج سبل العيش، وما الذي يجب أن يتغيّر في التخطيط والتمويل والشراكات المحلية حتى لا تعود المجتمعات إلى نقطة البداية عند أول أزمة.",
  coverAlt: "صورة توضيحية بالكحلي والذهبي",
  share: "أزرار المشاركة",
  shareIntro: "روابط مشاركة عادية، بلا أي سكربت من الشبكات. النسخ يُعلن نتيجته لقارئ الشاشة.",
  shareTitle: "دليل عملي لبناء مجلس أمناء فعّال",
  resources: "بطاقات الموارد",
  resourcesIntro: "تنزيل مباشر، وتنزيل مقابل البريد، ومورد بلا نوع ملف معروف.",
  resource1: "نموذج مصفوفة المخاطر المؤسسية",
  resourceText1: "جدول جاهز لتحديد المخاطر وتقييم احتمالها وأثرها ومتابعة خطط الاستجابة لها، مع مثال معبّأ.",
  resource2: "دليل إعداد السياسات الداخلية للمنظمات غير الربحية",
  resourceText2:
    "يشرح خطوة بخطوة كتابة سياسات المشتريات وتضارب المصالح والحماية والإبلاغ عن المخالفات، ومراجعتها واعتمادها من مجلس الأمناء.",
  resource3: "ورقة عمل: توطين العمل الإنساني",
  resourceText3: null,
  download: "تنزيل",
  getByEmail: "احصل عليه عبر البريد",
  media: "بطاقات الظهور الإعلامي",
  mediaIntro: "بصورة، وبإطار فيديو 16:9، وبدون صورة.",
  media1: "مقابلة حول حوكمة المساعدات الإنسانية",
  outlet1: "إذاعة التنمية",
  media2: "كلمة في المؤتمر الإقليمي للتنمية المستدامة",
  outlet2: "منتدى التنمية العربي",
  media3: "ورشة عمل: التخطيط الاستراتيجي للجمعيات الأهلية",
  outlet3: "اتحاد الجمعيات الأهلية",
  videoTitle: "فيديو: كلمة في المؤتمر الإقليمي للتنمية المستدامة",
  viewItem: "عرض التفاصيل",
  courses: "بطاقات الدورات",
  coursesIntro: "حضورية بمقاعد، وأونلاين بمقاعد قليلة، ومكتملة، ومسجلة بشارة «قريباً».",
  course1: "القيادة الاستراتيجية في المنظمات الإنسانية",
  courseText1: "برنامج تطبيقي من ثلاثة أيام لمديري البرامج وقادة الفرق في المنظمات المحلية والدولية.",
  place1: "الرياض، مركز المؤتمرات",
  course2: "إعداد مقترحات المشاريع للجهات المانحة",
  courseText2: "من تحليل المشكلة إلى الإطار المنطقي والميزانية، مع مراجعة مقترح حقيقي الطول.",
  course3: "أساسيات الحوكمة لأعضاء مجالس الإدارة",
  courseText3: null,
  place3: "عدن، مركز التدريب",
  course4: "الرصد والتقييم للمبتدئين",
  courseText4: "سلسلة دروس مسجلة تشاهدها في الوقت الذي يناسبك.",
  register: "سجّل الآن",
};

const en: typeof ar = {
  title: "Public listing components",
  intro: "For the blog, resources, media and training. Each component in its states; text comes from messages or content.",
  search: "Search",
  searchIntro: "A GET form that submits q and keeps the chosen category. Empty, then with an earlier search.",
  searchArticles: "Search articles",
  searchValue: "Governance in non-profit organizations",
  filters: "Filters",
  filtersIntro: "Links that set one param and go back to page 1. They scroll sideways on phones.",
  filterCategory: "Category",
  filterKind: "Resource type",
  categories: [
    { value: "governance", label: "Governance and institutional compliance" },
    { value: "management", label: "Strategic management" },
    { value: "humanitarian", label: "Humanitarian and relief work" },
    { value: "development", label: "Sustainable development and capacity building" },
    { value: "monitoring", label: "Monitoring, evaluation and accountability" },
  ],
  kinds: [
    { value: "guide", label: "Guides" },
    { value: "template", label: "Templates" },
    { value: "working_paper", label: "Working papers" },
  ],
  pagination: "Pagination",
  paginationIntro: "The first page, the middle of a list, then the last. On phones: previous, next and the page number.",
  articles: "Article cards",
  articlesIntro: "With and without a cover, a long title, and an excerpt cut after three lines.",
  article1: "A practical guide to building an effective board of trustees in new non-profit organizations",
  excerpt1:
    "How to choose members, divide roles and write bylaws that protect the organization's independence, with examples from local organizations working in fragile settings under shifting funding.",
  article2: "Accountability to affected communities",
  excerpt2: "Five practices that make complaint and feedback mechanisms part of the project cycle, not a formality.",
  article3: "From relief to recovery: when does development begin?",
  excerpt3:
    "A look at moves from emergency response to livelihood programs, and what must change in planning, funding and local partnerships so communities don't return to square one at the first crisis.",
  coverAlt: "Illustration in navy and gold",
  share: "Share buttons",
  shareIntro: "Plain share links, with no script from any network. Copying announces its result to screen readers.",
  shareTitle: "A practical guide to building an effective board of trustees",
  resources: "Resource cards",
  resourcesIntro: "A direct download, a download for an email, and a resource with no known file type.",
  resource1: "Institutional risk matrix template",
  resourceText1: "A ready table to identify risks, rate their likelihood and impact, and track responses, with a filled example.",
  resource2: "Guide to writing internal policies for non-profit organizations",
  resourceText2:
    "Explains step by step how to write procurement, conflict of interest, safeguarding and whistleblowing policies, and have the board review and adopt them.",
  resource3: "Working paper: localizing humanitarian action",
  resourceText3: null,
  download: "Download",
  getByEmail: "Get it by email",
  media: "Media cards",
  mediaIntro: "With an image, with a 16:9 video frame, and without an image.",
  media1: "Interview on the governance of humanitarian aid",
  outlet1: "Development Radio",
  media2: "Address at the regional conference on sustainable development",
  outlet2: "Arab Development Forum",
  media3: "Workshop: strategic planning for community associations",
  outlet3: "Union of Community Associations",
  videoTitle: "Video: address at the regional conference on sustainable development",
  viewItem: "View details",
  courses: "Course cards",
  coursesIntro: "In person with seats, online with few seats, full, and recorded with a \"Coming soon\" badge.",
  course1: "Strategic leadership in humanitarian organizations",
  courseText1: "A three-day applied program for program managers and team leads in local and international organizations.",
  place1: "Riyadh, Conference Center",
  course2: "Writing project proposals for donors",
  courseText2: "From problem analysis to the logical framework and budget, with a review of a real-length proposal.",
  course3: "Governance basics for board members",
  courseText3: null,
  place3: "Aden, Training Center",
  course4: "Monitoring and evaluation for beginners",
  courseText4: "A series of recorded lessons you watch when it suits you.",
  register: "Register now",
};

export type ListingText = typeof ar;
export const LISTING_TEXT: Record<Locale, ListingText> = { ar, en };
