import { handleNewsletterExport } from "@/lib/admin/newsletter/route";

export async function GET(request: Request) {
  return handleNewsletterExport(request);
}
