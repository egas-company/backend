import { createClient } from "redis";
import { logger } from "./logger";

const redis = createClient({
  url: process.env.REDIS_URL,
});

redis.on("error", err => logger.error("Redis Client Error", err));
redis.on("connect", () => logger.info("Redis Client Connected"));

export { redis };

export const connectRedis = async (): Promise<void> => {
  await redis.connect();
};

export const getRateLimit = async (key: string): Promise<number> => {
  const count = await redis.get(`rate:${key}`);
  return count ? parseInt(count) : 0;
};

export const incrementRateLimit = async (
  key: string,
  ttl: number
): Promise<void> => {
  await redis.incr(`rate:${key}`);
  await redis.expire(`rate:${key}`, ttl);
};
