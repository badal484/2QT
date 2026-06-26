const Jimp = require('jimp');
const fs = require('fs');

async function processImage(inputPath, outputPath) {
  try {
    const image = await Jimp.read(inputPath);
    console.log(`Processing ${inputPath}...`);
    
    // Convert black pixels to transparent based on luminance
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red   = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue  = this.bitmap.data[idx + 2];
      
      // Calculate perceived luminance (0 to 255)
      // Using standard sRGB luminance weights
      let luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
      
      // To preserve the glow colors and make it pop, we boost the luminance slightly 
      // for the alpha channel, so dark glows don't become too transparent.
      // But pure black (0) stays 0.
      let alpha = Math.min(255, luminance * 1.5);
      
      // If it's the checkerboard from the kitchen icon, it might have gray pixels.
      // We will treat dark gray as transparent too.
      // For the glowing neon parts, luminance will be high.
      if (luminance < 15) {
        alpha = 0;
      }
      
      this.bitmap.data[idx + 3] = Math.max(0, Math.min(255, alpha));
    });

    await image.writeAsync(outputPath);
    console.log(`Saved ${outputPath}`);
  } catch (err) {
    console.error(`Error processing ${inputPath}:`, err);
  }
}

async function main() {
  await processImage('../backend/public/images/kitchen_icon.png', '../backend/public/images/kitchen_icon.png');
  await processImage('../backend/public/images/customer_icon.png', '../backend/public/images/customer_icon.png');
}

main();
