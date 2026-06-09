require('dotenv').config();
const { Queue } = require('bullmq');
const connection = {
    host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
    port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port) : 6379,
};
const invoicesQueue = new Queue('2qt:invoices', { connection });
invoicesQueue.add('test', { foo: 'bar' }).then(() => {
    console.log("Added successfully");
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
