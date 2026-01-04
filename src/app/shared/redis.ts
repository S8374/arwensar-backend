import { createClient } from 'redis';
import { config } from '../../config';

export const redisClient = createClient({
    username: config.REDIS.USERNAME ,
    password: config.REDIS.PASSWORD ,
    socket: {
        host: config.REDIS.HOST ,
        port: Number(config.REDIS.PORT) ,
    }
});

redisClient.on('error', err => console.log('Redis Client Error', err));



// await client.set('foo', 'bar');
// const result = await client.get('foo');
// console.log(result)  // >>> bar


export const connectRedis = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log("Redis Connected");
    }
}