import { createClient } from 'redis';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;

const client = createClient({
    socket: {
        host: redisHost,
        port: redisPort
    }
});

client.on('error', (err) => console.error('Redis Client Error', err));
await client.connect();

const publisher = client.duplicate();
const subscriber = client.duplicate();

publisher.on('error', (err) => console.error('Redis Publisher Error', err));
subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));

await Promise.all([publisher.connect(), subscriber.connect()]);

export { client, publisher, subscriber };