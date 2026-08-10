require('dotenv').config({ path: __dirname + '/.env' });
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

async function run() {
    try {
        console.log("Uploading...");
        const response = await imagekit.upload({
            file: Buffer.from('hello world').toString('base64'),
            fileName: 'test.txt',
            folder: '/2qt/uploads',
        });
        console.log("Success:", response);
    } catch (e) {
        console.error("ImageKit Error:", e.message, e);
    }
}
run();
