/**
 * Temporary public host for PR evidence images.
 *
 * This Worker serves a screenshot referenced by a pull request. It is not a
 * general asset host and should not be reused as one.
 *
 * Expiry is enforced in code: once the deadline passes every request returns
 * 410 Gone regardless of path. Assets are inlined in the bundle, so there is no
 * bucket or storage backend to clean up separately.
 *
 * The Worker does not delete itself. A Cloudflare API token with
 * `Workers Scripts:Edit` can delete any Worker in the account, so the
 * credential needed for self-deletion is broader than the job warrants. The
 * daily cron only reports that the deadline has passed; the scheduled
 * `retire-evidence-host` GitHub workflow performs the actual delete.
 */

const WORKER_NAME = "arhen-pi-pr-4-evidence";
const EXPIRES_AT = Date.parse("2026-11-16T22:16:21Z");

interface Asset {
	default: ArrayBuffer;
}

const ASSETS: Record<string, () => Promise<Asset>> = {
	"/subagent-followup-queue.webp": () => import("./assets/subagent-followup-queue.webp"),
};

async function handleRequest(request: Request): Promise<Response> {
	if (Date.now() >= EXPIRES_AT) {
		return new Response("Gone. This temporary evidence host expired on 2026-11-16.\n", {
			status: 410,
			headers: { "content-type": "text/plain; charset=utf-8" },
		});
	}

	const url = new URL(request.url);
	const path = url.pathname === "/" ? "/subagent-followup-queue.webp" : url.pathname;
	const load = ASSETS[path];

	if (!load) {
		return new Response("Not found.\n", {
			status: 404,
			headers: { "content-type": "text/plain; charset=utf-8" },
		});
	}

	const asset = await load();

	return new Response(asset.default, {
		headers: {
			"content-type": "image/webp",
			"cache-control": "public, max-age=86400",
			"access-control-allow-origin": "*",
		},
	});
}

/**
 * Reports the deadline once it passes. Intentionally does no deletion: that
 * requires an account-wide token this Worker should not hold. The scheduled
 * workflow in the repository performs the removal.
 */
function handleScheduled(scheduledTime: number): void {
	if (scheduledTime < EXPIRES_AT) return;

	console.warn(
		`[${WORKER_NAME}] expired at ${new Date(EXPIRES_AT).toISOString()}. ` +
			"This evidence host now returns 410 and is ready to delete. " +
			"Run the `retire-evidence-host` workflow or `wrangler delete " +
			`${WORKER_NAME}\`.`,
	);
}

export default {
	fetch: handleRequest,
	scheduled(event: ScheduledController): void {
		handleScheduled(event.scheduledTime);
	},
};
