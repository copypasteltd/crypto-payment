export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue | undefined };

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type ListResponse<T extends JsonObject = JsonObject> = {
  items: T[];
  pageInfo: PageInfo;
  summary?: JsonObject;
};

export type AdminBootstrap = {
  user: { userId: string; email: string; displayName: string };
  role: "platform_admin";
  session: {
    sessionId: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
  };
  csrfToken: string;
  system: { status: "ready" | "degraded" | "not_ready"; release: string; checkedAt: string };
};
