"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/types";
import { FormMessage } from "./ui";

/** Formulario genérico para server actions con mensaje de éxito/error. */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}
