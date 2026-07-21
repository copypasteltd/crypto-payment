import { z } from "zod";
import { AppError } from "../../app/errors.js";

const wechatCodeSessionResponseSchema = z.object({
  openid: z.string().min(1).optional(),
  session_key: z.string().min(1).optional(),
  unionid: z.string().min(1).optional(),
  errcode: z.number().int().optional(),
  errmsg: z.string().optional(),
});

export type WechatMiniProgramCodeSession = {
  openId: string;
  unionId: string | null;
};

export type WechatMiniProgramCodeExchanger = (
  code: string
) => Promise<WechatMiniProgramCodeSession>;

export async function exchangeWechatMiniProgramCode(input: {
  code: string;
  appId?: string;
  appSecret?: string;
  apiBaseUrl: string;
  timeoutMs: number;
  fetcher?: typeof fetch;
}): Promise<WechatMiniProgramCodeSession> {
  if (!input.appId || !input.appSecret) {
    throw new AppError(
      503,
      "AUTH_WECHAT_NOT_CONFIGURED",
      "WeChat Mini Program login is not configured"
    );
  }

  const endpoint = new URL("/sns/jscode2session", input.apiBaseUrl);
  endpoint.searchParams.set("appid", input.appId);
  endpoint.searchParams.set("secret", input.appSecret);
  endpoint.searchParams.set("js_code", input.code);
  endpoint.searchParams.set("grant_type", "authorization_code");

  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)(endpoint, {
      method: "GET",
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch (error) {
    throw new AppError(
      502,
      "AUTH_WECHAT_UPSTREAM_UNAVAILABLE",
      error instanceof Error ? error.message : "WeChat login service is unavailable"
    );
  }

  if (!response.ok) {
    throw new AppError(
      502,
      "AUTH_WECHAT_UPSTREAM_HTTP_ERROR",
      `WeChat login service returned HTTP ${response.status}`
    );
  }

  let payload: z.infer<typeof wechatCodeSessionResponseSchema>;
  try {
    payload = wechatCodeSessionResponseSchema.parse(await response.json());
  } catch {
    throw new AppError(
      502,
      "AUTH_WECHAT_UPSTREAM_INVALID_RESPONSE",
      "WeChat login service returned an invalid response"
    );
  }

  if (payload.errcode != null && payload.errcode !== 0) {
    throw new AppError(
      401,
      "AUTH_WECHAT_CODE_INVALID",
      `WeChat login code was rejected (${payload.errcode})`
    );
  }

  if (!payload.openid || !payload.session_key) {
    throw new AppError(
      502,
      "AUTH_WECHAT_UPSTREAM_INVALID_RESPONSE",
      "WeChat login response is missing account identifiers"
    );
  }

  return {
    openId: payload.openid,
    unionId: payload.unionid ?? null,
  };
}
