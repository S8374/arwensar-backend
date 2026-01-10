// src/app/shared/redis.ts
import { createClient } from 'redis';
import { ConnectionOptions } from 'bullmq';
import { config } from '../../config';

// Create Redis client
export const redisClient = createClient({
  username: config.REDIS.USERNAME,
  password: config.REDIS.PASSWORD,
  socket: {
    host: config.REDIS.HOST,
    port: Number(config.REDIS.PORT),
  }
});

redisClient.on('error', err => console.log('Redis Client Error', err));

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("✅ Redis Connected");
  }
  return redisClient;
};

// BullMQ connection configuration
export const getBullMQConnection = (): ConnectionOptions => {
  return {
    host: config.REDIS.HOST,
    port: Number(config.REDIS.PORT),
    username: config.REDIS.USERNAME,
    password: config.REDIS.PASSWORD,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => {
      return Math.min(times * 50, 2000);
    }
  };
};

// Get Redis URL for BullMQ
export const getRedisUrl = (): string => {
  const { USERNAME, PASSWORD, HOST, PORT } = config.REDIS;
  if (USERNAME && PASSWORD) {
    return `redis://${USERNAME}:${PASSWORD}@${HOST}:${PORT}`;
  }
  return `redis://${HOST}:${PORT}`;
};