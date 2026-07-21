import { z } from "zod";

if (process.env.TARO_PLATFORM === "mini") {
  z.config({ jitless: true });
}

export { z };
