require('dotenv').config({ path: __dirname + '/.env' });
const fs = require('fs');
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
            file: fs.readFileSync('/Users/badal11/Desktop/VELTO_FOOD_PALACE/web/public/window.svg').toString('base64'),
            fileName: 'window.svg',
            folder: '/velto/uploads',
        });
        console.log("Success:", response);
    } catch (e) {
        console.log("Error keys:", Object.keys(e));
        console.log("Error message:", e.message);
        console.log("Error name:", e.name);
        console.log("Error code:", e.code);
    }
}
run();
