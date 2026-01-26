import 'dotenv/config';
import { Queue } from 'bullmq';

async function check() {
  const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  };

  const queue = new Queue('quarantine-reprocess', { connection: redisConnection });

  // Get completed jobs
  const completed = await queue.getCompleted(0, 10);
  console.log(`Found ${completed.length} recent completed jobs:\n`);

  for (const job of completed.slice(0, 5)) {
    console.log(`Job ID: ${job.id}`);
    console.log(`  recordId: ${job.data.quarantineRecordId}`);
    console.log(`  batchId: ${job.data.batchId}`);
    console.log(`  processedOn: ${job.processedOn ? new Date(job.processedOn).toISOString() : 'N/A'}`);
    console.log(`  returnvalue:`, JSON.stringify(job.returnvalue));
    console.log('');
  }

  // Check total completed count
  const counts = await queue.getJobCounts();
  console.log('Queue counts:', counts);

  await queue.close();
}

check().catch(console.error);
