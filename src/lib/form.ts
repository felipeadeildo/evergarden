/** A text field from a form, or an empty string when it is missing or a file. */
export function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
