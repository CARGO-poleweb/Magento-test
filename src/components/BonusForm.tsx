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
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          ))}
        </div>
      ) : (
        <input
          name="value"
          defaultValue={current?.value ?? ""}
          placeholder={placeholder}
          autoComplete="off"
          className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-white px-3 py-1.5 text-sm font-semibold hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "…" : current ? "Modifier" : "Sceller"}
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? "text-accent" : "text-danger"}`}>
            {result.title}
          </span>
        )}
      </div>
    </form>
  );
}
