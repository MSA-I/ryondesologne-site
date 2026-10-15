// Mail-app forms: no server. States on the <form data-state>: idle -> sending -> sent | error.
// "sent" = the message was handed to the visitor's mail app (it leaves from there), never "envoyé".
import routing from "../data/mail-routing.json";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDOFF_MS = 700;

/** mailto: URL. `body` is a label -> value record, written one "label : value" line each. */
export function buildMailto(to, subject, body) {
  const lines = Object.entries(body)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k} : ${v}`)
    .join("\r\n");
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (lines) params.push(`body=${encodeURIComponent(lines)}`);
  return `mailto:${to}${params.length ? `?${params.join("&")}` : ""}`;
}

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const table = new Map(Object.entries(routing).filter(([k]) => k !== "default").map(([k, v]) => [norm(k), v]));

/** Recipient by subject (accent and case blind); `fixed` wins; unknown subjects use `default`. */
export function recipientFor(subject, fixed) {
  return fixed || table.get(norm(subject || "")) || routing.default;
}

const frDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : iso);

function setSubmit(form, sending) {
  const btn = form.querySelector("[data-submit]");
  if (!btn) return;
  btn.setAttribute("aria-disabled", String(sending));
  btn.textContent = sending ? form.dataset.sending : btn.dataset.label;
}

function clearError(control) {
  control.removeAttribute("aria-invalid");
  control.removeAttribute("aria-describedby");
  const slot = control.closest("[data-field-wrap]")?.querySelector("[data-error]");
  if (slot) slot.textContent = "";
}

function validate(form) {
  let first = null;
  for (const control of form.querySelectorAll("[data-field]")) {
    const value = control.value.trim();
    let message = "";
    if (control.required && value === "") message = form.dataset.errRequired;
    else if (control.type === "email" && value !== "" && !EMAIL.test(value)) message = form.dataset.errEmail;
    const slot = control.closest("[data-field-wrap]").querySelector("[data-error]");
    if (message) {
      control.setAttribute("aria-invalid", "true");
      control.setAttribute("aria-describedby", slot.id);
      slot.textContent = message;
      first ??= control;
    } else clearError(control);
  }
  return first;
}

function showSent(form, to) {
  const status = form.querySelector("[data-status]");
  status.textContent = `${form.dataset.sent} `;
  const link = document.createElement("a");
  link.href = `mailto:${to}`;
  link.textContent = to;
  link.dir = "ltr";
  status.append(link);
}

function submit(form, event) {
  event.preventDefault();
  if (form.dataset.state === "sending") return;
  const alertBox = form.querySelector("[data-form-error]");
  const status = form.querySelector("[data-status]");
  status.textContent = "";
  const invalid = validate(form);
  if (invalid) {
    form.dataset.state = "error";
    alertBox.textContent = form.dataset.errForm;
    invalid.focus();
    return;
  }
  alertBox.textContent = "";

  const body = {};
  let subject = form.dataset.subject || "";
  for (const control of form.querySelectorAll("[data-field]")) {
    const value = control.type === "date" ? frDate(control.value) : control.value.trim();
    if (control.hasAttribute("data-subject-field")) subject = value;
    else body[control.dataset.label] = value;
  }
  const to = recipientFor(subject, form.dataset.to);
  const url = buildMailto(to, subject, body);

  form.dataset.state = "sending";
  setSubmit(form, true);
  form.dispatchEvent(new CustomEvent("mailform:handoff", { bubbles: true, detail: { url, to, subject } }));
  window.location.href = url;
  setTimeout(() => {
    form.dataset.state = "sent";
    setSubmit(form, false);
    showSent(form, to);
  }, HANDOFF_MS);
}

export function initMailForms() {
  const sujet = new URLSearchParams(window.location.search).get("sujet");
  for (const form of document.querySelectorAll("form[data-mailform]")) {
    const field = form.querySelector("[data-subject-field]");
    if (field && sujet && field.value === "") field.value = sujet.slice(0, 200);
    form.addEventListener("submit", (event) => submit(form, event));
    form.addEventListener("input", (event) => {
      if (event.target.matches("[data-field]")) clearError(event.target);
    });
  }
}
