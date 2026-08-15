export function makeAdminTablesResizableAndSticky() {
    // 1. Inject CSS for Sticky Header & Resizer styling
    if (!document.getElementById('admin-table-utils-style')) {
        const style = document.createElement('style');
        style.id = 'admin-table-utils-style';
        style.innerHTML = `
            /* Wrapper adjustments to enable sticky scrolling */
            .table-card {
                overflow: auto;
                max-height: calc(100vh - 240px); /* Adjust based on typical admin page layout */
                position: relative;
            }
            .table-card::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            .table-card::-webkit-scrollbar-thumb {
                background: var(--border, #E2E8F0);
                border-radius: 4px;
            }

            /* Sticky Header */
            .data-table {
                table-layout: fixed; /* Better for column resizing */
            }
            .data-table thead {
                position: sticky;
                top: 0;
                z-index: 20;
                background-color: #F8FAFC;
                box-shadow: 0 1px 0 var(--border), 0 -1px 0 var(--border);
            }
            .data-table th {
                position: relative; /* relative context for absolute resizer */
                background-clip: padding-box;
                white-space: nowrap;
                user-select: none;
                /* By default th is given a % width. Revert to auto if needed or let original css handle it */
            }
            
            /* Resizer */
            .data-table th .resizer {
                width: 5px;
                height: 100%;
                position: absolute;
                right: 0;
                top: 0;
                cursor: col-resize;
                z-index: 21;
                touch-action: none; /* Prevent scroll on touch devices during drag */
            }
            .data-table th .resizer:hover, .data-table th .resizer.resizing {
                background-color: var(--primary, #4F46E5);
                opacity: 0.5;
            }
            
            /* When resizing, prevent text selection across the body */
            body.resizing-columns {
                cursor: col-resize;
                user-select: none;
            }
        `;
        document.head.appendChild(style);
    }

    // Function to attach resizers to a specific table
    const attachResizers = (table) => {
        const cols = table.querySelectorAll('thead th');
        if (!cols || cols.length === 0) return;

        cols.forEach(col => {
            // Check if already has resizer
            if (col.querySelector('.resizer')) return;

            const resizer = document.createElement('div');
            resizer.classList.add('resizer');
            col.appendChild(resizer);
            
            let x = 0;
            let w = 0;
            
            const mouseDownHandler = function(e) {
                x = e.clientX;
                const styles = window.getComputedStyle(col);
                w = parseInt(styles.width, 10);
                
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
                
                resizer.classList.add('resizing');
                document.body.classList.add('resizing-columns');
            };
            
            const mouseMoveHandler = function(e) {
                const dx = e.clientX - x;
                col.style.width = `${w + dx}px`;
                col.style.minWidth = `${w + dx}px`;
            };
            
            const mouseUpHandler = function() {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                
                resizer.classList.remove('resizing');
                document.body.classList.remove('resizing-columns');
            };
            
            resizer.addEventListener('mousedown', mouseDownHandler);
        });
    };

    // Apply to existing tables
    const tables = document.querySelectorAll('.data-table');
    tables.forEach(table => attachResizers(table));

    // Observe changes in the document to attach to dynamically created tables or headers
    const observer = new MutationObserver((mutationsList) => {
        let shouldCheck = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                shouldCheck = true;
                break;
            }
        }
        
        if (shouldCheck) {
            const dynamicTables = document.querySelectorAll('.data-table');
            dynamicTables.forEach(table => attachResizers(table));
        }
    });

    // Observe the main content area for changes
    const contentArea = document.querySelector('.content-area') || document.body;
    if (contentArea) {
        observer.observe(contentArea, { childList: true, subtree: true });
    }
}
