let quillLoaded = false;
let quillLoadingPromise = null;

export async function loadQuillAndTribute() {
    if (quillLoaded) return true;
    if (quillLoadingPromise) return quillLoadingPromise;

    quillLoadingPromise = new Promise((resolve, reject) => {
        const quillCss = document.createElement('link');
        quillCss.rel = 'stylesheet';
        quillCss.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
        
        const tributeCss = document.createElement('link');
        tributeCss.rel = 'stylesheet';
        tributeCss.href = 'https://unpkg.com/tributejs/dist/tribute.css';

        document.head.appendChild(quillCss);
        document.head.appendChild(tributeCss);

        const quillJs = document.createElement('script');
        quillJs.src = 'https://cdn.quilljs.com/1.3.6/quill.min.js';
        
        quillJs.onload = () => {
            const tributeJs = document.createElement('script');
            tributeJs.src = 'https://unpkg.com/tributejs/dist/tribute.min.js';
            tributeJs.onload = () => {
                quillLoaded = true;
                resolve(true);
            };
            tributeJs.onerror = reject;
            document.body.appendChild(tributeJs);
        };
        quillJs.onerror = reject;
        document.body.appendChild(quillJs);
    });

    return quillLoadingPromise;
}

window.loadQuillAndTribute = loadQuillAndTribute;
