// Minimal JSON Schema subset validator used to enforce a discovered upstream
// tool's declared inputSchema before policy evaluation and execution (F2). It
// covers the shapes the discovered manifests actually declare: typed objects
// with properties/required/additionalProperties, typed arrays with items, and
// primitive scalar types. It returns the first failure path, never throws.

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
};

export function validateAgainstSchema(value: unknown, schema: JsonSchema | undefined, path = "arguments"): string | null {
  if (!schema || typeof schema !== "object") return null;

  if (typeof schema.type === "string") {
    const typeError = checkType(value, schema.type, path);
    if (typeError) return typeError;
  }

  const looksLikeObject = schema.type === "object" || schema.properties !== undefined || schema.required !== undefined || schema.additionalProperties === false;
  if (looksLikeObject) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return `${path} must be an object`;
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) return `${path}.${key} is required`;
    }
    const known = new Set(Object.keys(schema.properties ?? {}));
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!known.has(key)) return `${path}.${key} is not an allowed property`;
      }
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in record) {
        const childError = validateAgainstSchema(record[key], child, `${path}.${key}`);
        if (childError) return childError;
      }
    }
    return null;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) return `${path} must be an array`;
    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        const itemError = validateAgainstSchema(value[index], schema.items, `${path}[${index}]`);
        if (itemError) return itemError;
      }
    }
    return null;
  }

  return null;
}

function checkType(value: unknown, type: string, path: string): string | null {
  switch (type) {
    case "string": return typeof value === "string" ? null : `${path} must be a string`;
    case "number": return typeof value === "number" && Number.isFinite(value) ? null : `${path} must be a number`;
    case "integer": return typeof value === "number" && Number.isInteger(value) ? null : `${path} must be an integer`;
    case "boolean": return typeof value === "boolean" ? null : `${path} must be a boolean`;
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value) ? null : `${path} must be an object`;
    case "array": return Array.isArray(value) ? null : `${path} must be an array`;
    default: return null;
  }
}
