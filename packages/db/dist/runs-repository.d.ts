import { type RunAggregate, type RunsRepository } from "./runs.js";
import type { PostgresRepositoryOptions } from "./postgres-types.js";
export declare abstract class CachedRunsRepository implements RunsRepository {
    #private;
    init(): Promise<void>;
    get(runId: string): RunAggregate | null;
    list(): RunAggregate[];
    save(aggregate: RunAggregate): Promise<RunAggregate>;
    update(runId: string, updater: (current: RunAggregate) => RunAggregate): Promise<RunAggregate | null>;
    clear(): Promise<void>;
    protected abstract loadAll(): Promise<RunAggregate[]>;
    protected abstract persist(aggregate: RunAggregate): Promise<void>;
    protected abstract clearStorage(): Promise<void>;
}
export declare class PostgresRunsRepository extends CachedRunsRepository {
    #private;
    constructor(options: PostgresRepositoryOptions);
    protected loadAll(): Promise<RunAggregate[]>;
    protected persist(aggregate: RunAggregate): Promise<void>;
    protected clearStorage(): Promise<void>;
}
//# sourceMappingURL=runs-repository.d.ts.map