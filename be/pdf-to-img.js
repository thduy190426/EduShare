const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');

const STANDARD_FONT_DATA_URL = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/';

class NodeCanvasFactory {
    create(width, height) {
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        return {
            canvas,
            context,
        };
    }

    reset(canvasAndContext, width, height) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}

async function convertPdfToImages(pdfPath, maxPages = 3) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({
        data,
        cMapUrl: path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'cmaps') + '/',
        cMapPacked: true,
        standardFontDataUrl: STANDARD_FONT_DATA_URL,
        disableFontFace: true,
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = Math.min(pdfDocument.numPages, maxPages);
    const images = [];
    const canvasFactory = new NodeCanvasFactory();

    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); 

        const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
        
        const renderContext = {
            canvasContext: canvasAndContext.context,
            viewport: viewport,
            canvasFactory: canvasFactory,
        };

        await page.render(renderContext).promise;
        const imageBuffer = canvasAndContext.canvas.toBuffer('image/png');
        images.push(imageBuffer);
        
        canvasFactory.destroy(canvasAndContext);
    }

    return images;
}

module.exports = { convertPdfToImages };
