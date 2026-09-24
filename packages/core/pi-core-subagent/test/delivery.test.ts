import { describe, expect, test } from "bun:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SubagentManager } from "../src/manager.ts";
import type { RunSnapshot, TaskSnapshot, UsageStats } from "../src/types.ts";

const usage: UsageStats = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 1 };
type Kind = "completed" | "failed" | "aborted";

/**
 * Every child->leader lifecycle notice steers. A `followUp` notice only surfaces once the leader
 * stops calling tools, so a leader that keeps working — or never rests — sees completions too late
 * to act on them while the queue accumulates.
 */
describe("all lifecycle notices steer", () => {
	function capture(task: Partial<TaskSnapshot>, kind: Kind) {
		const sent: {
			message: { customType: string; content: string; display: boolean };
			options?: { triggerTurn?: boolean; deliverAs?: string };
		}[] = [];
		const pi = {
			events: { emit() {} },
			sendMessage(
				message: { customType: string; content: string; display: boolean },
				options?: { triggerTurn?: boolean; deliverAs?: string },
			) {
				sent.push({ message, options });
			},
		} as unknown as ExtensionAPI;

		const base: TaskSnapshot = {
			id: "task_1",
			runId: "run_x",
			agent: "a",
			task: "do it",
			cwd: "/tmp",
			status: kind,
			toolCalls: 0,
			usage,
			...task,
		};
		const run = { id: "run_x", mode: "parallel", status: kind, tasks: [base] } as unknown as RunSnapshot;
		const manager = new SubagentManager(pi) as unknown as {
			notifyTask: (run: RunSnapshot, task: TaskSnapshot, kind: Kind) => void;
		};
		manager.notifyTask(run, base, kind);
		return sent[0];
	}

	test("a failed task remains visible to the leader as a subagent notice", () => {
		const notice = capture({ finalText: "half done", error: "429 rate limited" }, "failed");
		expect(notice?.message).toMatchObject({ customType: "subagent", display: true });
		expect(notice?.message.content).toContain("resume_subagent");
		expect(notice?.options).toEqual({ triggerTurn: true, deliverAs: "steer" });
	});

	test("a never-started task also wakes the leader", () => {
		expect(capture({ finalText: "", error: "Model not found: nope/x" }, "failed")?.options).toEqual({
			triggerTurn: true,
			deliverAs: "steer",
		});
	});

	test("completed and aborted tasks are subagent messages that steer", () => {
		for (const [task, kind] of [
			[{ finalText: "done" }, "completed"],
			[{ error: "cancelled" }, "aborted"],
		] as const) {
			const notice = capture(task, kind);
			expect(notice?.message).toMatchObject({ customType: "subagent", display: true });
			expect(notice?.options).toEqual({ triggerTurn: true, deliverAs: "steer" });
		}
	});
});
