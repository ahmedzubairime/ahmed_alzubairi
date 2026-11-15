import { handleCustomRequest } from "@/lib/training/route";

export async function POST(request: Request) {
  return handleCustomRequest(request);
}
