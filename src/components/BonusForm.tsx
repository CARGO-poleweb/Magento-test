"use client";

import { useActionState } from "react";
import { submitHiddenBonus, type ActionResult } from "@/app/actions";
import type { BonusType } from "@/lib/types";

export function BonusForm({
  type,
  triple,
  placeholder,
  current,
}: {
  type: BonusType;
  triple?: boolean;
  placeholder: string;
  current?: { value?: string; values?: string[] };
}) {
  const [result, formAction, pending] = useActionState<ActionResult | null, FormData>(
    submitHiddenBonus,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="type" value={type} />
      {triple ? (
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3].map((i) => (
            <input
              key={i}
              name={`value_${i}`}
              defaultValue={current?.values?.[i - 1] ?? ""}
              placeholder={`${i}. ${placeholder}`}
              autoComplete="off"
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
          ))}
        </div>
      ) : (
        <input
          name="value"
          defaultValue={current?.value ?? ""}
          placeholder={placeholder}
          autoComplete="off"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-green-600"
        />
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
        >
          {pending ? "…" : current ? "Modifier (scellé 🔒)" : "Sceller 🔒"}
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? "text-green-400" : "text-red-400"}`}>
            {result.title}
          </span>
        )}
      </div>
    </form>
  );
}
