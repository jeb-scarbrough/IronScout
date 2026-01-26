import 'dotenv/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

async function test() {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;

  console.log('Testing quarantine queue...');
  console.log('Redis:', redisHost + ':' + redisPort);

  const redisConnection = {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: null,
  };

  // Create a test queue
  const queue = new Queue('quarantine-reprocess', { connection: redisConnection });

  // Add a test job
  const testJobId = `TEST_${Date.now()}`;
  console.log('\nEnqueuing test job:', testJobId);

  const job = await queue.add(
    'REPROCESS_QUARANTINE',
    {
      quarantineRecordId: 'TEST_RECORD',
      feedType: 'AFFILIATE',
      triggeredBy: 'test@test.com',
      batchId: 'test-batch',
    },
    { jobId: testJobId }
  );

  console.log('Job enqueued:', job.id);

  // Wait a moment for worker to pick it up
  console.log('\nWaiting 3 seconds for worker to process...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check job status
  const jobState = await job.getState();
  console.log('Job state after 3s:', jobState);

  if (jobState === 'waiting') {
    console.log('\n⚠️  Job is still WAITING - worker may not be running or connected');
  } else if (jobState === 'completed') {
    console.log('\n✅ Job was COMPLETED - worker is running');
  } else if (jobState === 'active') {
    console.log('\n🔄 Job is ACTIVE - worker is processing');
  } else if (jobState === 'failed') {
    console.log('\n❌ Job FAILED - check worker logs');
  }

  // Clean up test job
  await job.remove();
  console.log('\nTest job removed');

  await queue.close();
}

test().catch(console.error);
