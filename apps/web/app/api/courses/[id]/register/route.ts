import { handleRegister } from "@/lib/training/route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRegister(request, (await params).id);
}
