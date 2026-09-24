export type TemplateVars = {
  order_id: string;
  business_name: string;
  customer_name?: string | null;
  tracking_url?: string;
};

export const TEMPLATE_VARIABLES = ["{order_id}", "{business_name}", "{customer_name}", "{tracking_url}"];

/** Reemplaza {variable}; las desconocidas se dejan tal cual. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) => {
      const value = (vars as Record<string, string | null | undefined>)[key];
      return value === undefined ? match : (value ?? "");
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
