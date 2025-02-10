(function() {
    const savedConfig = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
    if (savedConfig.theme) {
        document.documentElement.classList.toggle('dark', savedConfig.theme === 'dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }
})();
