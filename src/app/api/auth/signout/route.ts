import { signOut } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  await signOut({ redirectTo: "/login" });
}
