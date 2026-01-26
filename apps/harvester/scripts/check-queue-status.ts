import 'dotenv/config';
import Redis from 'ioredis';

async function check() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  });

  console.log('Queue Status Check\n');
  console.log('Connected to Redis:', process.env.REDIS_HOST + ':' + process.env.REDIS_PORT);

  // Check queues
  const queues = [
    'quarantine-reprocess',
    'product-resolve',
    'affiliate-feed',
  ];

  for (const queue of queues) {
    console.log(`\n=== ${queue} ===`);

    const waitingLen = await redis.llen(`bull:${queue}:wait`);
    const activeLen = await redis.llen(`bull:${queue}:active`);
    const delayedCount = await redis.zcard(`bull:${queue}:delayed`);
    const completedCount = await redis.zcard(`bull:${queue}:completed`);
    const failedCount = await redis.zcard(`bull:${queue}:failed`);

    console.log('  waiting:', waitingLen);
    console.log('  active:', activeLen);
    console.log('  delayed:', delayedCount);
    console.log('  completed:', completedCount);
    console.log('  failed:', failedCount);

    // Check for workers
    const workers = await redis.smembers(`bull:${queue}:workers`);
    console.log('  workers registered:', workers.length);
  }

  await redis.quit();
}

check().catch(console.error);
