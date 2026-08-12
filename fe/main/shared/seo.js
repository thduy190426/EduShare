
export function updateSEO(title, description) {
    if (title) {
        document.title = `${title} — EduShare`;

        let ogTitle = document.querySelector('meta[property="og:title"]');
        if (!ogTitle) {
            ogTitle = document.createElement('meta');
            ogTitle.setAttribute('property', 'og:title');
            document.head.appendChild(ogTitle);
        }
        ogTitle.setAttribute('content', document.title);
    }

    if (description) {
        const cleanDesc = description.replace(/<[^>]*>?/gm, '').trim(); 
        const shortDesc = cleanDesc.length > 155 ? cleanDesc.substring(0, 152) + '...' : cleanDesc;

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', shortDesc || title);

        let ogDesc = document.querySelector('meta[property="og:description"]');
        if (!ogDesc) {
            ogDesc = document.createElement('meta');
            ogDesc.setAttribute('property', 'og:description');
            document.head.appendChild(ogDesc);
        }
        ogDesc.setAttribute('content', shortDesc || title);
    }
}
