function setupPasswordMasking(visualId, realId, toggleBtnId) {
    const visualInput = document.getElementById(visualId);
    const realInput = document.getElementById(realId);
    const toggleBtn = document.getElementById(toggleBtnId);
    const toggleIcon = toggleBtn ? toggleBtn.querySelector('i') : null;
    
    let realValue = "";
    let isVisible = false;
    let maskTimeout = null;

    if (!visualInput || !realInput) return;

    // Apply basic transition styles
    visualInput.style.transition = 'letter-spacing 0.3s ease, color 0.3s ease';
    
    // Sync initial value if any (e.g., from browser autofill)
    if (realInput.value && !visualInput.value) {
        realValue = realInput.value;
        visualInput.value = '*'.repeat(realValue.length);
        visualInput.style.letterSpacing = '2px';
    }

    // Toggle visibility
    if (toggleBtn) {
        // Clone to remove old listeners
        const newToggleBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
        const newToggleIcon = newToggleBtn.querySelector('i');

        newToggleBtn.addEventListener('click', () => {
            isVisible = !isVisible;
            if (isVisible) {
                visualInput.value = realValue;
                visualInput.style.letterSpacing = 'normal';
                if(newToggleIcon) {
                    newToggleIcon.classList.remove('fa-eye');
                    newToggleIcon.classList.add('fa-eye-slash');
                }
            } else {
                visualInput.value = '*'.repeat(realValue.length);
                visualInput.style.letterSpacing = '2px';
                if(newToggleIcon) {
                    newToggleIcon.classList.remove('fa-eye-slash');
                    newToggleIcon.classList.add('fa-eye');
                }
            }
            visualInput.focus();
        });
    }

    visualInput.addEventListener('input', (e) => {
        const visualValue = visualInput.value;
        const cursor = visualInput.selectionStart;
        
        if (isVisible) {
            realValue = visualValue;
            realInput.value = realValue;
            realInput.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        if (visualValue.length > realValue.length) {
            const diff = visualValue.length - realValue.length;
            const added = visualValue.substring(cursor - diff, cursor);
            realValue = realValue.substring(0, cursor - diff) + added + realValue.substring(cursor - diff);
        } else if (visualValue.length < realValue.length) {
            const diff = realValue.length - visualValue.length;
            realValue = realValue.substring(0, cursor) + realValue.substring(cursor + diff);
        } else {
            const lastChar = visualValue.substring(cursor - 1, cursor);
            if (lastChar !== '*') {
                realValue = realValue.substring(0, cursor - 1) + lastChar + realValue.substring(cursor);
            }
        }
        
        realInput.value = realValue;
        realInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        visualInput.style.letterSpacing = 'normal';
        let masked = "";
        for(let i = 0; i < realValue.length; i++) {
            if (i === cursor - 1 && e.inputType !== 'deleteContentBackward' && e.inputType !== 'deleteContentForward') {
                masked += realValue[i]; // Show the last typed character
            } else {
                masked += '*'; // Asterisk for masked
            }
        }
        visualInput.value = masked;
        visualInput.setSelectionRange(cursor, cursor);
        
        clearTimeout(maskTimeout);
        maskTimeout = setTimeout(() => {
            if (!isVisible) {
                const cur = visualInput.selectionStart;
                visualInput.value = '*'.repeat(realValue.length);
                visualInput.style.letterSpacing = '2px';
                if (document.activeElement === visualInput) {
                    visualInput.setSelectionRange(cur, cur);
                }
            }
        }, 300); // 300ms delay for modern feel
    });

    visualInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.originalEvent || e).clipboardData.getData('text/plain');
        const cursor = visualInput.selectionStart;
        const cursorEnd = visualInput.selectionEnd;
        
        realValue = realValue.substring(0, cursor) + text + realValue.substring(cursorEnd);
        realInput.value = realValue;
        realInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        if (isVisible) {
            visualInput.value = realValue;
            visualInput.style.letterSpacing = 'normal';
        } else {
            visualInput.value = '*'.repeat(realValue.length);
            visualInput.style.letterSpacing = '2px';
        }
        
        const newCursor = cursor + text.length;
        visualInput.setSelectionRange(newCursor, newCursor);
    });
}
