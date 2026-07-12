import { type QuotaDecisionKind, type QuotaPolicy, type QuotaWindowType } from "@lingban/contracts";
export declare function resolveQuotaWindowRange(windowType: QuotaWindowType, at: string | Date): {
    windowStartedAt: string;
    windowEndsAt: string;
};
export declare function evaluateQuotaPolicyValue(policy: QuotaPolicy, currentValue: number): {
    decision: QuotaDecisionKind;
    matchedLimit: number | null;
};
export declare function quotaDecisionSeverity(decision: QuotaDecisionKind): 1 | 4 | 3 | 2;
//# sourceMappingURL=quota.d.ts.map