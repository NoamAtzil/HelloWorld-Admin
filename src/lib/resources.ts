// One config per managed table. The generic /manage/[resource] page and the
// generic save/delete actions are driven entirely by this file, and only the
// tables listed here can ever be touched by them (unknown names are rejected).
// Authorization is NOT here: requireAdmin() runs first on every page and
// action, and the database's superadmin-only policies decide in the end.

export type FieldType = "text" | "textarea" | "number" | "boolean" | "select";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** text length, or numeric maximum */
  max?: number;
  min?: number;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** select options loaded from another table */
  fk?: { table: string; label: string };
  defaultValue?: string | number | boolean;
};

export type ColumnKind = "text" | "bool" | "date" | "clip" | "mono" | "number" | "status" | "image";

export type Column = {
  /** column name, or "relation.column" for an embedded row */
  path: string;
  label: string;
  kind?: ColumnKind;
  align?: "right";
};

export type Resource = {
  key: string;
  title: string;
  singular: string;
  description: string;
  table: string;
  select: string;
  order: { column: string; ascending: boolean };
  searchColumns?: string[];
  /** crud: create/edit/delete; readonly: list only; update-only: edit the listed fields only */
  mode: "crud" | "readonly" | "update-only";
  fields: Field[];
  columns: Column[];
  deleteWarning?: string;
  notice?: string;
  empty: string;
};

export const VOICE_OPTIONS = [
  { value: "classic", label: "Classic" },
  { value: "roast", label: "Roast Master" },
  { value: "noir", label: "Noir Detective" },
  { value: "nature", label: "Nature Doc" },
  { value: "grandma", label: "Passive-Aggressive Grandma" },
  { value: "hype", label: "Sports Announcer" },
];

const active: Field = { name: "is_active", label: "Active", type: "boolean", defaultValue: true };

export const RESOURCES: Record<string, Resource> = {
  // Handled by the dedicated image form/actions (uploads), not the generic ones.
  images: {
    key: "images",
    title: "Images",
    singular: "image",
    description: "",
    table: "images",
    select: "*",
    order: { column: "created_at", ascending: false },
    searchColumns: ["title", "description"],
    mode: "crud",
    fields: [],
    columns: [],
    empty: "No images yet.",
  },
  terms: {
    key: "terms",
    title: "Terms",
    singular: "term",
    description: "A vocabulary of creative terms and styles.",
    table: "terms",
    select: "*",
    order: { column: "term", ascending: true },
    searchColumns: ["term", "definition", "category"],
    mode: "crud",
    fields: [
      { name: "term", label: "Term", type: "text", required: true, max: 80 },
      { name: "definition", label: "Definition", type: "textarea", max: 1000 },
      { name: "category", label: "Category", type: "text", max: 40, placeholder: "style, slang, …" },
      active,
    ],
    columns: [
      { path: "term", label: "Term" },
      { path: "category", label: "Category" },
      { path: "definition", label: "Definition", kind: "clip" },
      { path: "is_active", label: "Active", kind: "bool" },
      { path: "updated_at", label: "Updated", kind: "date" },
    ],
    empty: "No terms yet. Add the first one.",
  },
  examples: {
    key: "examples",
    title: "AI generation examples",
    singular: "example",
    description: "Example inputs and outputs for testing and prompt design.",
    table: "generation_examples",
    select: "*",
    order: { column: "created_at", ascending: false },
    searchColumns: ["title", "caption", "direction"],
    mode: "crud",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 120 },
      { name: "direction", label: "Direction (input)", type: "text", max: 200, placeholder: "roast us gently" },
      { name: "voice", label: "Voice", type: "select", options: VOICE_OPTIONS },
      { name: "caption", label: "Example caption (output)", type: "textarea", required: true, max: 500 },
      { name: "library_file", label: "Library image file", type: "text", max: 120, placeholder: "03-chasing-the-1-train.jpg" },
      { name: "notes", label: "Notes", type: "textarea", max: 1000 },
      active,
    ],
    columns: [
      { path: "title", label: "Title" },
      { path: "voice", label: "Voice" },
      { path: "direction", label: "Direction", kind: "clip" },
      { path: "caption", label: "Caption", kind: "clip" },
      { path: "is_active", label: "Active", kind: "bool" },
    ],
    empty: "No examples yet.",
  },
  chains: {
    key: "chains",
    title: "Prompt chains",
    singular: "prompt chain",
    description:
      "Reusable instruction recipes. Configuration only: the live Gemini prompts stay in the application code.",
    table: "prompt_chains",
    select: "*",
    order: { column: "name", ascending: true },
    searchColumns: ["name", "description"],
    mode: "crud",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 80 },
      { name: "description", label: "Description", type: "textarea", max: 500 },
      { name: "voice_id", label: "Related voice", type: "select", options: VOICE_OPTIONS },
      active,
    ],
    columns: [
      { path: "name", label: "Name" },
      { path: "voice_id", label: "Voice" },
      { path: "description", label: "Description", kind: "clip" },
      { path: "is_active", label: "Active", kind: "bool" },
    ],
    deleteWarning: "Deleting a chain also deletes its steps and mix rows.",
    empty: "No prompt chains yet.",
  },
  steps: {
    key: "steps",
    title: "Prompt chain steps",
    singular: "step",
    description: "The ordered instructions inside each chain.",
    table: "prompt_chain_steps",
    select: "*, prompt_chains(name)",
    order: { column: "created_at", ascending: false },
    searchColumns: ["instruction"],
    mode: "crud",
    fields: [
      { name: "chain_id", label: "Chain", type: "select", required: true, fk: { table: "prompt_chains", label: "name" } },
      { name: "position", label: "Position", type: "number", required: true, min: 1, max: 50, defaultValue: 1 },
      { name: "instruction", label: "Instruction", type: "textarea", required: true, max: 1000 },
    ],
    columns: [
      { path: "prompt_chains.name", label: "Chain" },
      { path: "position", label: "#", kind: "number", align: "right" },
      { path: "instruction", label: "Instruction", kind: "clip" },
      { path: "updated_at", label: "Updated", kind: "date" },
    ],
    deleteWarning: "Deleting a step also deletes its mix row.",
    empty: "No steps yet.",
  },
  mix: {
    key: "mix",
    title: "Prompt chain mix",
    singular: "mix row",
    description:
      "How strongly each step counts within its chain (0–100). Rows appear automatically with each step; you can adjust the weight.",
    table: "prompt_chain_mix",
    select: "*, prompt_chains(name), prompt_chain_steps(position, instruction)",
    order: { column: "chain_id", ascending: true },
    mode: "update-only",
    fields: [{ name: "weight", label: "Weight (0–100)", type: "number", required: true, min: 0, max: 100 }],
    columns: [
      { path: "prompt_chains.name", label: "Chain" },
      { path: "prompt_chain_steps.position", label: "Step", kind: "number", align: "right" },
      { path: "prompt_chain_steps.instruction", label: "Instruction", kind: "clip" },
      { path: "weight", label: "Weight", kind: "number", align: "right" },
    ],
    empty: "No mix rows yet. They are created when you add steps.",
  },
  models: {
    key: "models",
    title: "LLM models",
    singular: "model",
    description: "The models the product can use. History keeps pointing at a model, so used models can't be deleted.",
    table: "llm_models",
    select: "*, llm_providers(name)",
    order: { column: "created_at", ascending: true },
    searchColumns: ["display_name", "model_id"],
    mode: "crud",
    fields: [
      { name: "provider_id", label: "Provider", type: "select", required: true, fk: { table: "llm_providers", label: "name" } },
      { name: "model_id", label: "Model ID", type: "text", required: true, max: 100, placeholder: "gemini-flash-latest" },
      { name: "display_name", label: "Display name", type: "text", required: true, max: 80 },
      active,
      { name: "is_default", label: "Default model", type: "boolean", help: "Only one model can be the default." },
    ],
    columns: [
      { path: "display_name", label: "Name" },
      { path: "model_id", label: "Model ID", kind: "mono" },
      { path: "llm_providers.name", label: "Provider" },
      { path: "is_default", label: "Default", kind: "bool" },
      { path: "is_active", label: "Active", kind: "bool" },
    ],
    deleteWarning: "A model that appears in the generation log cannot be deleted; deactivate it instead.",
    empty: "No models yet.",
  },
  providers: {
    key: "providers",
    title: "LLM providers",
    singular: "provider",
    description: "The AI services behind the models.",
    table: "llm_providers",
    select: "*",
    order: { column: "created_at", ascending: true },
    searchColumns: ["name"],
    mode: "crud",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 80 },
      { name: "base_url", label: "Base URL", type: "text", max: 200, placeholder: "https://…" },
      active,
    ],
    columns: [
      { path: "name", label: "Name" },
      { path: "base_url", label: "Base URL", kind: "mono" },
      { path: "is_active", label: "Active", kind: "bool" },
    ],
    deleteWarning: "A provider that still has models cannot be deleted.",
    empty: "No providers yet.",
  },
  requests: {
    key: "requests",
    title: "Generation requests",
    singular: "request",
    description:
      "Real Studio requests, newest first. Only the typed direction, voice, image name, model, status and timing are kept: no images, IP addresses or secrets.",
    table: "generation_requests",
    select: "*",
    order: { column: "created_at", ascending: false },
    searchColumns: ["direction", "voice", "model_name"],
    mode: "readonly",
    fields: [],
    columns: [
      { path: "created_at", label: "When", kind: "date" },
      { path: "kind", label: "Kind" },
      { path: "voice", label: "Voice" },
      { path: "direction", label: "Direction", kind: "clip" },
      { path: "source", label: "Photo" },
      { path: "model_name", label: "Model", kind: "mono" },
      { path: "status", label: "Status", kind: "status" },
      { path: "latency_ms", label: "ms", kind: "number", align: "right" },
    ],
    empty: "No requests logged yet. They appear once members or visitors generate captions.",
  },
  responses: {
    key: "responses",
    title: "LLM responses",
    singular: "response",
    description: "What the model returned for each logged request.",
    table: "llm_responses",
    select: "*, generation_requests(kind, voice)",
    order: { column: "created_at", ascending: false },
    searchColumns: ["response_text"],
    mode: "readonly",
    fields: [],
    columns: [
      { path: "created_at", label: "When", kind: "date" },
      { path: "request_id", label: "Request", kind: "number", align: "right" },
      { path: "generation_requests.kind", label: "Kind" },
      { path: "response_text", label: "Response", kind: "clip" },
      { path: "finish_reason", label: "Finish" },
      { path: "error_code", label: "Error" },
      { path: "latency_ms", label: "ms", kind: "number", align: "right" },
    ],
    empty: "No responses logged yet.",
  },
  domains: {
    key: "domains",
    title: "Allowed signup domains",
    singular: "domain",
    description: "Email domains that may sign up.",
    table: "allowed_signup_domains",
    select: "*",
    order: { column: "domain", ascending: true },
    searchColumns: ["domain", "note"],
    mode: "crud",
    fields: [
      { name: "domain", label: "Domain", type: "text", required: true, max: 253, placeholder: "columbia.edu", help: "Stored in lower case." },
      { name: "note", label: "Note", type: "text", max: 200 },
    ],
    columns: [
      { path: "domain", label: "Domain", kind: "mono" },
      { path: "note", label: "Note" },
      { path: "created_at", label: "Added", kind: "date" },
    ],
    notice:
      "These rules are recorded here but are not enforced yet: anyone with a Google account can still sign in, so nothing can be locked out by editing them.",
    empty: "No allowed domains yet.",
  },
  emails: {
    key: "emails",
    title: "Whitelisted email addresses",
    singular: "email",
    description: "Individual email addresses that may sign up.",
    table: "whitelisted_emails",
    select: "*",
    order: { column: "email", ascending: true },
    searchColumns: ["email", "note"],
    mode: "crud",
    fields: [
      { name: "email", label: "Email", type: "text", required: true, max: 254, placeholder: "name@example.com", help: "Stored in lower case." },
      { name: "note", label: "Note", type: "text", max: 200 },
    ],
    columns: [
      { path: "email", label: "Email", kind: "mono" },
      { path: "note", label: "Note" },
      { path: "created_at", label: "Added", kind: "date" },
    ],
    notice:
      "These rules are recorded here but are not enforced yet: anyone with a Google account can still sign in, so nothing can be locked out by editing them.",
    empty: "No whitelisted emails yet.",
  },
};

export function getResource(key: string): Resource | null {
  return Object.prototype.hasOwnProperty.call(RESOURCES, key) ? RESOURCES[key] : null;
}
