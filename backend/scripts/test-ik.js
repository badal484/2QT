require('dotenv').config();
const ImageKit = require('@imagekit/nodejs');
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});
console.log(imagekit.options);
imagekit.files.upload({
  file: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  fileName: "test.png",
  folder: "/test"
}).then(console.log).catch(err => console.error("ERR:", err.message));
