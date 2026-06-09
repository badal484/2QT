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
            file: Buffer.from('hello').toString('base64'),
            fileName: '123456_Screenshot 2026-06-01 at 3.45.40 PM.png',
            folder: '/2qt/uploads',
        });
        console.log("Success:", response);
    } catch (e) {
        console.log("Error keys:", Object.keys(e));
        console.log("Error message:", e.message);
        console.log("Error full:", e);
    }
}
run();
