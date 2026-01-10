"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisUrl = exports.getBullMQConnection = exports.connectRedis = exports.redisClient = void 0;
// src/app/shared/redis.ts
const redis_1 = require("redis");
const config_1 = require("../../config");
// Create Redis client
exports.redisClient = (0, redis_1.createClient)({
    username: config_1.config.REDIS.USERNAME,
    password: config_1.config.REDIS.PASSWORD,
    socket: {
        host: config_1.config.REDIS.HOST,
        port: Number(config_1.config.REDIS.PORT),
    }
});
exports.redisClient.on('error', err => console.log('Redis Client Error', err));
const connectRedis = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!exports.redisClient.isOpen) {
        yield exports.redisClient.connect();
        console.log("✅ Redis Connected");
    }
    return exports.redisClient;
});
exports.connectRedis = connectRedis;
// BullMQ connection configuration
const getBullMQConnection = () => {
    return {
        host: config_1.config.REDIS.HOST,
        port: Number(config_1.config.REDIS.PORT),
        username: config_1.config.REDIS.USERNAME,
        password: config_1.config.REDIS.PASSWORD,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
            return Math.min(times * 50, 2000);
        }
    };
};
exports.getBullMQConnection = getBullMQConnection;
// Get Redis URL for BullMQ
const getRedisUrl = () => {
    const { USERNAME, PASSWORD, HOST, PORT } = config_1.config.REDIS;
    if (USERNAME && PASSWORD) {
        return `redis://${USERNAME}:${PASSWORD}@${HOST}:${PORT}`;
    }
    return `redis://${HOST}:${PORT}`;
};
exports.getRedisUrl = getRedisUrl;
