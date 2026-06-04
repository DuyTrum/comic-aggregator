const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function convertSvgToPng() {
    try {
        // Read SVG content
        const svgContent = fs.readFileSync('./dinosaur-icon.svg', 'utf-8');
        
        // Create data URL
        const svgDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svgContent).toString('base64');
        
        // Load image
        const img = await loadImage(svgDataUrl);
        
        // Create 256x256 canvas for appIcon
        const canvas256 = createCanvas(256, 256);
        const ctx256 = canvas256.getContext('2d');
        ctx256.drawImage(img, 0, 0, 256, 256);
        
        // Save appIcon.png
        const buffer256 = canvas256.toBuffer('image/png');
        fs.writeFileSync('./appIcon.png', buffer256);
        console.log('✅ Created appIcon.png (256x256)');
        
        // Create 32x32 canvas for trayIcon
        const canvas32 = createCanvas(32, 32);
        const ctx32 = canvas32.getContext('2d');
        ctx32.drawImage(img, 0, 0, 32, 32);
        
        // Save trayIcon.png
        const buffer32 = canvas32.toBuffer('image/png');
        fs.writeFileSync('./trayIcon.png', buffer32);
        console.log('✅ Created trayIcon.png (32x32)');
        
        console.log('\n🎉 Icon conversion completed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('canvas')) {
            console.log('\n📦 Installing canvas package...');
            console.log('Run: npm install canvas');
        }
    }
}

convertSvgToPng();
