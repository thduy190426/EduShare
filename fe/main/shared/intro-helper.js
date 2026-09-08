export function startIntroTour(customSteps = []) {
    if (typeof introJs !== 'function') return;

    const intro = introJs();
    let options = {
        nextLabel: 'Tiếp theo <i class="fa-solid fa-arrow-right fa-sm" style="margin-left: 4px;"></i>',
        prevLabel: '<i class="fa-solid fa-arrow-left fa-sm" style="margin-right: 4px;"></i> Quay lại',
        skipLabel: 'Bỏ qua',
        doneLabel: 'Hoàn thành <i class="fa-solid fa-check fa-sm" style="margin-left: 4px;"></i>',
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: false,
        exitOnEsc: false
    };

    if (customSteps && customSteps.length > 0) {
        options.steps = customSteps;
    }

    intro.setOptions(options);
    intro.start();
}
