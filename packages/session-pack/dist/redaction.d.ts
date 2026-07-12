import { type SessionPackBundle } from "./pack.js";
import { type SessionPackRedactionRule } from "./schema.js";
export interface SessionPackRedactionRuleReport {
    ruleId: string;
    targetKind: SessionPackRedactionRule["target"]["kind"];
    selector: string;
    matches: number;
    mutatedEntries: string[];
}
export interface SessionPackRedactionReport {
    ruleCount: number;
    matchedRuleCount: number;
    totalMatches: number;
    mutatedEntries: string[];
    rules: SessionPackRedactionRuleReport[];
}
export interface ApplySessionPackRedactionOptions {
    metadata?: Record<string, boolean | number | string>;
}
export interface ApplySessionPackRedactionResult {
    bundle: SessionPackBundle;
    report: SessionPackRedactionReport;
}
export declare function applySessionPackRedaction(bundle: SessionPackBundle, options?: ApplySessionPackRedactionOptions): ApplySessionPackRedactionResult;
//# sourceMappingURL=redaction.d.ts.map