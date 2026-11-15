import { handleResourceDownloadRequest } from "@/lib/resources/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  return handleResourceDownloadRequest(request, (await params).id);
}
