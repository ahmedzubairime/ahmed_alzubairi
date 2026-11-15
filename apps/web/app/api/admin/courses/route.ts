import { handleCoursesRequest } from "@/lib/admin/courses/route";

export async function GET(request: Request) {
  return handleCoursesRequest(request);
}

export async function POST(request: Request) {
  return handleCoursesRequest(request);
}

export async function PATCH(request: Request) {
  return handleCoursesRequest(request);
}
