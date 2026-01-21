// lib_do_fauno.js - Aesthetic Manipulation for Biblioteca do Fauno
// Uses Lucide Icons for a cozy fantasy feel

(function() {
    // 1. Load Lucide Icons from CDN
    if (!document.getElementById('lucide-script')) {
        const script = document.createElement('script');
        script.id = 'lucide-script';
        script.src = 'https://unpkg.com/lucide@latest';
        script.onload = () => {
            const checkReady = setInterval(() => {
                if (window.lucide) {
                    clearInterval(checkReady);
                    initAesthetics();
                }
            }, 100);
        };
        document.head.appendChild(script);
    }

    function initAesthetics() {
        console.log("Biblioteca do Fauno: Aesthetics Initialized");
        
        // Replace existing icons with Lucide
        replaceIcons();
        
        // Observe DOM changes (for dynamic content like the Bookshelf app)
        const observer = new MutationObserver((mutations) => {
            if (window.lucide) {
                window.lucide.createIcons();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        
        // Initial run
        window.lucide.createIcons();
    }

    function replaceIcons() {
        // Map Glyphicons to Lucide
        const iconMap = {
            'glyphicon-home': 'compass',
            'glyphicon-book': 'book',
            'glyphicon-search': 'search',
            'glyphicon-user': 'user',
            'glyphicon-log-out': 'log-out',
            'glyphicon-log-in': 'log-in',
            'glyphicon-tasks': 'activity',
            'glyphicon-dashboard': 'layout',
            'glyphicon-info-sign': 'info',
            'glyphicon-list': 'layers',
            'glyphicon-calendar': 'calendar',
            'glyphicon-cog': 'settings',
            'glyphicon-pencil': 'feather',
            'glyphicon-plus': 'plus-circle'
        };

        // Also map Material Symbols used in Bookshelf app
        const bookshelfMap = {
            'shelves': 'library',
            'auto_stories': 'book-open',
            'query_stats': 'bar-chart-2',
            'build': 'hammer',
            'person': 'user',
            'settings': 'settings',
            'add': 'plus'
        };

        // 1. Process Glyphicons (Standard Calibre-Web)
        Object.keys(iconMap).forEach(cls => {
            const elements = document.querySelectorAll('.' + cls);
            elements.forEach(el => {
                const iconName = iconMap[cls];
                // Create lucide icon element
                const lucideIcon = document.createElement('i');
                lucideIcon.setAttribute('data-lucide', iconName);
                lucideIcon.className = 'lucide';
                
                // Replace parent if it's just a placeholder span
                el.parentNode.replaceChild(lucideIcon, el);
            });
        });

        // 2. Process Material Symbols (Bookshelf App)
        const symbols = document.querySelectorAll('.material-symbols-outlined');
        symbols.forEach(el => {
            const text = el.textContent.trim();
            if (bookshelfMap[text]) {
                const iconName = bookshelfMap[text];
                const lucideIcon = document.createElement('i');
                lucideIcon.setAttribute('data-lucide', iconName);
                lucideIcon.className = 'lucide';
                el.parentNode.replaceChild(lucideIcon, el);
            }
        });
        
        if (window.lucide) window.lucide.createIcons();
    }
})();
