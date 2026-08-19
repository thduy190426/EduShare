export function makeAdminTablesResizableAndSticky() {
    if (!document.getElementById('admin-table-utils-style')) {
        const style = document.createElement('style');
        style.id = 'admin-table-utils-style';
        style.innerHTML = `
            .table-card {
                overflow: auto;
                max-height: calc(100vh - 240px); 
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

            .data-table {
                table-layout: fixed; 
            }
            .data-table thead {
                position: sticky;
                top: 0;
                z-index: 20;
                background-color: #F8FAFC;
                box-shadow: 0 1px 0 var(--border), 0 -1px 0 var(--border);
            }
            .data-table th {
                position: relative; 
                background-clip: padding-box;
                white-space: nowrap;
                user-select: none;
            }
            
            .data-table th .resizer {
                width: 5px;
                height: 100%;
                position: absolute;
                right: 0;
                top: 0;
                cursor: col-resize;
                z-index: 21;
                touch-action: none; 
            }
            .data-table th .resizer:hover, .data-table th .resizer.resizing {
                background-color: var(--primary, #4F46E5);
                opacity: 0.5;
            }
            
            body.resizing-columns {
                cursor: col-resize;
                user-select: none;
            }
        `;
        document.head.appendChild(style);
    }

    const attachResizers = (table) => {
        const cols = table.querySelectorAll('thead th');
        if (!cols || cols.length === 0) return;

        cols.forEach(col => {
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

    const tables = document.querySelectorAll('.data-table');
    tables.forEach(table => attachResizers(table));

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

    const contentArea = document.querySelector('.content-area') || document.body;
    if (contentArea) {
        observer.observe(contentArea, { childList: true, subtree: true });
    }
}
