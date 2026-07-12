import { quotaDecisionKindSchema, quotaPolicySchema, quotaWindowTypeSchema, } from "@lingban/contracts";
export function resolveQuotaWindowRange(windowType, at) {
    const parsedWindowType = quotaWindowTypeSchema.parse(windowType);
    const date = at instanceof Date ? new Date(at.getTime()) : new Date(at);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid quota window timestamp: ${String(at)}`);
    }
    if (parsedWindowType === "instant") {
        const startedAt = date.toISOString();
        return {
            windowStartedAt: startedAt,
            windowEndsAt: startedAt,
        };
    }
    const start = new Date(date.getTime());
    start.setUTCHours(0, 0, 0, 0);
    if (parsedWindowType === "monthly") {
        start.setUTCDate(1);
    }
    const end = new Date(start.getTime());
    if (parsedWindowType === "daily") {
        end.setUTCDate(end.getUTCDate() + 1);
    }
    else {
        end.setUTCMonth(end.getUTCMonth() + 1);
    }
    return {
        windowStartedAt: start.toISOString(),
        windowEndsAt: end.toISOString(),
    };
}
export function evaluateQuotaPolicyValue(policy, currentValue) {
    const parsedPolicy = quotaPolicySchema.parse(policy);
    const normalizedValue = Number.isFinite(currentValue) ? Math.max(0, currentValue) : 0;
    const hardLimit = parsedPolicy.hardLimitValue ?? parsedPolicy.limitValue;
    const softLimit = parsedPolicy.softLimitValue;
    if (hardLimit != null && normalizedValue > hardLimit) {
        const decision = parsedPolicy.actionOnHardLimit === "require_override" ? "require_approval" : "block";
        return {
            decision: quotaDecisionKindSchema.parse(decision),
            matchedLimit: hardLimit,
        };
    }
    if (softLimit != null && normalizedValue > softLimit) {
        const decision = parsedPolicy.actionOnSoftLimit === "require_approval" ? "require_approval" : "warn";
        return {
            decision: quotaDecisionKindSchema.parse(decision),
            matchedLimit: softLimit,
        };
    }
    return {
        decision: quotaDecisionKindSchema.parse("allow"),
        matchedLimit: null,
    };
}
export function quotaDecisionSeverity(decision) {
    const parsed = quotaDecisionKindSchema.parse(decision);
    switch (parsed) {
        case "block":
            return 4;
        case "require_approval":
            return 3;
        case "warn":
            return 2;
        case "allow":
        default:
            return 1;
    }
}
//# sourceMappingURL=quota.js.map