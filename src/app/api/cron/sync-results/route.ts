import { NextResponse, type NextRequest } from "next/server";
import { syncResultsFromApi } from "@/app/actions";

/**
 * Tâche planifiée : va chercher les scores de la journée et remplit les
 * matchs encore vides. Déclarée dans vercel.json ; protégée par CRON_SECRET
 * quand la variable est définie.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "non autorisé" }, { status: 401 });
  }

  const result = await syncResultsFromApi();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
