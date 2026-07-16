import type { FieldErrors, FieldValues, Path, SubmitErrorHandler } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import i18n from "../i18n";
import { toast } from "../lib/toast";

type LabelMap<T extends FieldValues> = Partial<Record<Path<T>, string>>;

function flattenErrors<T extends FieldValues>(errors: FieldErrors<T>, labels: LabelMap<T>) {
  return Object.entries(errors).flatMap(([name, value]) => {
    if (!value || typeof value !== "object") return [];
    const message = "message" in value && typeof value.message === "string"
      ? value.message
      : i18n.t("common:validation.required", { defaultValue: "请检查该字段" });
    return [`${labels[name as Path<T>] ?? name}：${message}`];
  });
}

export function notifyFormInvalid<T extends FieldValues>(errors: FieldErrors<T>, labels: LabelMap<T>, title = i18n.t("common:toast.formInvalid")) {
  const messages = flattenErrors(errors, labels);
  toast.warning(title, {
    description: messages.length ? messages.join("；") : i18n.t("common:validation.required"),
    dedupeKey: `form-invalid:${title}:${messages.join("|")}`,
  });
}

export function invalidSubmitHandler<T extends FieldValues>(labels: LabelMap<T>, title?: string): SubmitErrorHandler<T> {
  return (errors) => notifyFormInvalid(errors, labels, title);
}

export function FormErrorSummary<T extends FieldValues>({ errors, labels }: { errors: FieldErrors<T>; labels: LabelMap<T> }) {
  const messages = flattenErrors(errors, labels);
  if (!messages.length) return null;
  return (
    <div className="form-error-summary" role="alert">
      <AlertTriangle size={17} aria-hidden="true" />
      <div><strong>{i18n.t("common:toast.formInvalid")}</strong><ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul></div>
    </div>
  );
}
