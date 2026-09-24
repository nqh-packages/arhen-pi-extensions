import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelCatalog } from "./types.ts";

export const MODEL_CONFIG_FILENAME = "subagent-models.json";

/** User-owned advice shown alongside, but never used to choose, subagent models. */
export interface CatalogAdvice {
	path: string;
	default?: string;
	note?: string;
	error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalText(
	record: Record<string, unknown>,
	field: "default" | "note",
	errors: string[],
): string | undefined {
	const value = record[field];
	if (value === undefined) return undefined;
	if (typeof value !== "string" || !value.trim()) {
		errors.push(`${field} must be a non-empty string`);
		return undefined;
	}
	return value.trim();
}

/** Parse only the catalog-advice fields; unrelated user configuration remains untouched. */
export function parseCatalogAdvice(text: string, path = MODEL_CONFIG_FILENAME): CatalogAdvice {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		return {
			path,
			error: `not valid JSON (${error instanceof Error ? error.message : String(error)})`,
		};
	}
	if (!isRecord(parsed)) return { path, error: "must be a JSON object" };

	const errors: string[] = [];
	const defaultModel = optionalText(parsed, "default", errors);
	const note = optionalText(parsed, "note", errors);
	return {
		path,
		...(defaultModel ? { default: defaultModel } : {}),
		...(note ? { note } : {}),
		...(errors.length > 0 ? { error: errors.join("; ") } : {}),
	};
}

/** Read optional user-owned catalog advice without making model discovery depend on a config file. */
export function loadCatalogAdvice(agentDir: string): CatalogAdvice {
	const path = join(agentDir, MODEL_CONFIG_FILENAME);
	if (!existsSync(path)) return { path };
	try {
		return parseCatalogAdvice(readFileSync(path, "utf8"), path);
	} catch (error) {
		return {
			path,
			error: `could not be read (${error instanceof Error ? error.message : String(error)})`,
		};
	}
}

/**
 * Attach user advice after Pi has resolved the catalog. Advice can only name a reference already
 * listed by Pi, so it cannot widen the session scope or become an implicit model choice.
 */
export function applyCatalogAdvice(catalog: ModelCatalog, advice: CatalogAdvice): ModelCatalog {
	const defaultIsListed = advice.default ? catalog.models.some((model) => model.reference === advice.default) : false;
	const unavailableDefault =
		advice.default && !defaultIsListed
			? `default \`${advice.default}\` is not ${catalog.scope === "session" ? "enabled for this session" : "available in this session"}`
			: undefined;
	const errors = [advice.error, unavailableDefault].filter((error): error is string => Boolean(error));

	return {
		...catalog,
		...(defaultIsListed && advice.default ? { preferredDefault: advice.default } : {}),
		...(advice.note ? { advisory: advice.note } : {}),
		...(errors.length > 0 ? { configError: `${advice.path}: ${errors.join("; ")}` } : {}),
	};
}
