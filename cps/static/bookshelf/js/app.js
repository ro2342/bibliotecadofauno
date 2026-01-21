// --- CONFIGURAÇÃO E INICIALIZAÇÃO ---
const GOOGLE_BOOKS_API_KEY = ""; // Not used in local version currently

let userId = "local-user";
let allBooks = [];
let userShelves = [];
let userProfile = {};
let currentFilter = 'todos';
let currentPage = 1;
let itemsPerPage = 10;
let apiSearchResults = [];
let currentApiResultIndex = 0;
let shelfSearchTerm = '';
let shelfPaginationState = {}; // Armazena o estado da paginação de cada estante

const fixedShelves = [
    { id: 'lendo', name: 'Lendo Agora' },
    { id: 'lido', name: 'Lidos' },
    { id: 'quero-ler', name: 'Quero Ler' },
    { id: 'abandonado', name: 'Abandonados' }
];

// Array de sentimentos para a nova funcionalidade
const sentimentos = [
    'curiosidade', 'inspiração', 'reflexão', 'relaxamento', 'comoção', 'surpresa', 'paixão', 'diversão', 'alegria', 'surto', 'ansiedade', 'aflição', 'distração', 'confusão', 'raiva', 'medo', 'vulnerabilidade', 'vergonha', 'frustração', 'tristeza', 'cansaço', 'tédio', 'conexão', 'foco', 'intensidade', 'excitação', 'choque', 'horror', 'nojo', 'indiferença'
];


// --- SISTEMA DE TEMAS ---
const themes = {
    'fauno': { name: 'Biblioteca do Fauno', values: { primary: '68 60% 35%', onPrimary: '40 25% 98%', primaryContainer: '68 40% 25%', onPrimaryContainer: '40 25% 95%', surface: '40 25% 90%', onSurface: '25 25% 15%', surfaceContainerHigh: '40 20% 85%', onSurfaceVariant: '25 15% 30%', outline: '25 10% 50%' } },
    'dark': { name: 'Padrão Escuro', values: { primary: '190 80% 60%', onPrimary: '210 30% 10%', primaryContainer: '190 70% 30%', onPrimaryContainer: '190 80% 90%', surface: '220 15% 12%', onSurface: '220 10% 90%', surfaceContainerHigh: '220 15% 18%', onSurfaceVariant: '220 10% 70%', outline: '220 10% 40%' } },
    'sunset': { name: 'Sunset', values: { primary: '15 90% 60%', onPrimary: '15 90% 10%', primaryContainer: '15 80% 85%', onPrimaryContainer: '15 90% 20%', surface: '30 30% 15%', onSurface: '30 20% 95%', surfaceContainerHigh: '30 25% 20%', onSurfaceVariant: '30 15% 70%', outline: '30 10% 45%' } },
    'forest': { name: 'Forest', values: { primary: '140 60% 50%', onPrimary: '140 60% 95%', primaryContainer: '140 40% 25%', onPrimaryContainer: '140 50% 85%', surface: '120 10% 10%', onSurface: '120 15% 90%', surfaceContainerHigh: '120 10% 15%', onSurfaceVariant: '120 10% 60%', outline: '120 5% 35%' } },
    'nonbinary_pride': { name: 'Non-Binary Pride', values: { primary: '55 100% 60%', onPrimary: '55 100% 5%', primaryContainer: '270 50% 30%', onPrimaryContainer: '270 50% 90%', surface: '0 0% 10%', onSurface: '0 0% 95%', surfaceContainerHigh: '0 0% 15%', onSurfaceVariant: '0 0% 70%', outline: '0 0% 45%' } },
    'taylor_swift': { name: 'Taylor Swift (Debut)', values: { primary: '150 70% 60%', onPrimary: '150 100% 5%', primaryContainer: '150 50% 20%', onPrimaryContainer: '150 70% 90%', surface: '150 10% 10%', onSurface: '150 15% 90%', surfaceContainerHigh: '150 10% 15%', onSurfaceVariant: '150 10% 70%', outline: '150 5% 40%' } },
    'fearless': { name: 'Fearless', values: { primary: '50 90% 65%', onPrimary: '50 100% 10%', primaryContainer: '50 60% 30%', onPrimaryContainer: '50 90% 90%', surface: '45 30% 15%', onSurface: '45 25% 95%', surfaceContainerHigh: '45 30% 20%', onSurfaceVariant: '45 20% 75%', outline: '45 15% 50%' } },
    'speak_now': { name: 'Speak Now', values: { primary: '280 80% 75%', onPrimary: '280 100% 10%', primaryContainer: '280 50% 35%', onPrimaryContainer: '280 80% 95%', surface: '280 20% 15%', onSurface: '280 20% 90%', surfaceContainerHigh: '280 20% 20%', onSurfaceVariant: '280 15% 70%', outline: '280 10% 45%' } },
    'red': { name: 'Red', values: { primary: '0 85% 60%', onPrimary: '0 100% 95%', primaryContainer: '0 60% 30%', onPrimaryContainer: '0 85% 95%', surface: '0 20% 10%', onSurface: '0 15% 90%', surfaceContainerHigh: '0 20% 18%', onSurfaceVariant: '0 10% 65%', outline: '0 5% 40%' } },
    '1989': { name: '1989', values: { primary: '200 80% 70%', onPrimary: '200 100% 10%', primaryContainer: '200 50% 30%', onPrimaryContainer: '200 80% 90%', surface: '35 25% 15%', onSurface: '35 25% 95%', surfaceContainerHigh: '35 25% 20%', onSurfaceVariant: '35 15% 70%', outline: '35 10% 45%' } },
    'reputation': { name: 'Reputation', values: { primary: '220 5% 80%', onPrimary: '0 0% 0%', primaryContainer: '220 5% 25%', onPrimaryContainer: '220 10% 90%', surface: '0 0% 8%', onSurface: '0 0% 90%', surfaceContainerHigh: '0 0% 12%', onSurfaceVariant: '0 0% 60%', outline: '0 0% 35%' } },
    'lover': { name: 'Lover', values: { primary: '320 90% 80%', onPrimary: '320 100% 15%', primaryContainer: '320 60% 35%', onPrimaryContainer: '320 90% 95%', surface: '240 20% 12%', onSurface: '240 20% 92%', surfaceContainerHigh: '240 20% 18%', onSurfaceVariant: '240 15% 70%', outline: '240 10% 45%' } },
    'folklore': { name: 'Folklore', values: { primary: '220 10% 75%', onPrimary: '220 10% 10%', primaryContainer: '220 10% 25%', onPrimaryContainer: '220 15% 90%', surface: '30 5% 10%', onSurface: '30 5% 85%', surfaceContainerHigh: '30 5% 15%', onSurfaceVariant: '30 5% 65%', outline: '30 5% 40%' } },
    'evermore': { name: 'Evermore', values: { primary: '35 40% 65%', onPrimary: '35 40% 10%', primaryContainer: '35 30% 25%', onPrimaryContainer: '35 40% 90%', surface: '30 15% 12%', onSurface: '30 15% 90%', surfaceContainerHigh: '30 15% 18%', onSurfaceVariant: '30 10% 70%', outline: '30 10% 45%' } },
    'midnights': { name: 'Midnights', values: { primary: '230 60% 70%', onPrimary: '230 100% 95%', primaryContainer: '230 50% 25%', onPrimaryContainer: '230 60% 90%', surface: '230 25% 10%', onSurface: '230 20% 92%', surfaceContainerHigh: '230 25% 15%', onSurfaceVariant: '230 15% 70%', outline: '230 10% 40%' } },
    'ttpd': { name: 'The Tortured Poets Department', values: { primary: '30 20% 80%', onPrimary: '30 20% 10%', primaryContainer: '30 15% 25%', onPrimaryContainer: '30 20% 90%', surface: '30 5% 8%', onSurface: '30 5% 90%', surfaceContainerHigh: '30 5% 12%', onSurfaceVariant: '30 5% 65%', outline: '30 5% 35%' } }
};
const themeOrder = ['dark', 'sunset', 'forest', 'nonbinary_pride', 'taylor_swift', 'fearless', 'speak_now', 'red', '1989', 'reputation', 'lover', 'folklore', 'evermore', 'midnights', 'ttpd'];

// Paleta de cores para os placeholders
const placeholderColors = [
    { bg: '455A64', fg: 'FFFFFF' }, { bg: '004D40', fg: 'FFFFFF' }, { bg: '827717', fg: 'FFFFFF' },
    { bg: '3E2723', fg: 'FFFFFF' }, { bg: 'BF360C', fg: 'FFFFFF' }, { bg: '0D47A1', fg: 'FFFFFF' },
    { bg: '4A148C', fg: 'FFFFFF' }, { bg: '880E4F', fg: 'FFFFFF' }, { bg: '263238', fg: 'FFFFFF' }
];

const style = document.createElement('style');
style.innerHTML = `@media (min-width: 768px) { .pag-hidden { display: none !important; } }`;
document.head.appendChild(style);


function applyTheme(themeName, saveToDb = true) {
    const theme = themes[themeName];
    if (!theme) return;

    for (const [key, value] of Object.entries(theme.values)) {
        const prop = `--md-sys-color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        document.documentElement.style.setProperty(prop, value);
    }

    localStorage.setItem('bookTrackerTheme', themeName);

    if (saveToDb && userId) {
        saveProfile({ theme: themeName }, false);
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('bookTrackerTheme');
    if (savedTheme && themes[savedTheme]) {
        applyTheme(savedTheme, false);
    } else {
        applyTheme('fauno', false);
    }
}

// --- Funções do Modal ---
function showModal(title, content, actions = []) {
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');

    let actionsHtml = actions.map(action => `<button id="${action.id}" class="btn-expressive ${action.class}">${action.text}</button>`).join('');
    const closeButtonHtml = `<button id="modal-close-x" class="absolute top-4 right-4 text-neutral-500 hover:text-white text-3xl leading-none z-20">&times;</button>`;

    modalContent.innerHTML = `<div class="relative p-8 max-w-lg w-full card-expressive">${closeButtonHtml}<h2 class="text-2xl font-bold mb-4">${title}</h2><div class="text-neutral-300 mb-6">${content}</div><div class="flex gap-4 justify-end">${actionsHtml}</div></div>`;
    modalContainer.classList.remove('hidden');

    modalContent.firstChild.onclick = (e) => e.stopPropagation();
    modalContainer.onclick = hideModal;
    document.getElementById('modal-close-x').onclick = hideModal;

    actions.forEach(action => {
        const btn = document.getElementById(action.id);
        if (btn) btn.onclick = () => {
            action.onClick();
            if (!action.keepOpen) hideModal();
        };
    });

    document.addEventListener('keydown', handleEscKey);
}

function hideModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.add('hidden');
    document.getElementById('modal-content').innerHTML = '';

    const currentHash = window.location.hash;
    if (currentHash.includes('#/book/') || currentHash.includes('#/add') || currentHash.includes('#/edit/')) {
        window.location.hash = '#/estantes';
    }

    window.scrollTo(0, 0);
    document.removeEventListener('keydown', handleEscKey);
}

function handleEscKey(event) {
    if (event.key === 'Escape') {
        hideModal();
    }
}

function showLoading(message = 'Aguarde...') {
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `<div class="flex flex-col items-center justify-center p-4 card-expressive"><p class="text-lg font-semibold mb-4">${message}</p><div class="w-full bg-neutral-700 rounded-full h-2.5"><div class="bg-[hsl(var(--md-sys-color-primary))] h-2.5 rounded-full animate-pulse"></div></div></div>`;
    modalContainer.classList.remove('hidden');
}


// --- LÓGICA DO FIREBASE E DO APLICATIVO ---

// --- LÓGICA DO APLICATIVO LOCAL ---

async function loadData() {
    document.getElementById('page-loader')?.classList.remove('hidden');
    try {
        const response = await fetch('/bookshelf/api/data');
        const result = await response.json();
        if (result.status === 'success') {
            allBooks = result.data.books || [];
            userShelves = result.data.shelves || [];
            userProfile = result.data.profile || {};
            
            // Map legacy fields if necessary
            allBooks = allBooks.map(b => ({
                ...b,
                addedAt: b.addedAt ? new Date(b.addedAt) : new Date(0)
            }));
            
            if (userProfile.theme) applyTheme(userProfile.theme, false);
            router();
        }
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        showModal("Erro de Ligação", "Não foi possível carregar os dados do servidor local.");
    } finally {
        document.getElementById('page-loader')?.classList.add('hidden');
    }
}

function initApp() {
    initTheme();
    setupInteractiveNav();
    loadData();
    window.addEventListener('hashchange', router);
    
    // Auto-refresh every 5 minutes if on dashboard
    setInterval(() => {
        if (window.location.hash === '#/estantes' || window.location.hash === '') {
            loadData();
        }
    }, 300000);
}

function setupInteractiveNav() {
    const nav = document.getElementById('desktop-nav');
    const main = document.getElementById('main-content');
    if (!nav || !main) return;

    const navExpandedWidth = '12rem';
    const navCollapsedWidth = '5rem';

    nav.addEventListener('mouseenter', () => {
        if (window.innerWidth >= 768) {
            nav.classList.add('expanded');
            nav.style.width = navExpandedWidth;
            main.style.marginLeft = navExpandedWidth;
        }
    });

    nav.addEventListener('mouseleave', () => {
        if (window.innerWidth >= 768) {
            nav.classList.remove('expanded');
            nav.style.width = navCollapsedWidth;
            main.style.marginLeft = navCollapsedWidth;
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth < 768) {
            nav.style.width = '';
            main.style.marginLeft = '';
        } else {
            if (nav.classList.contains('expanded')) {
                nav.style.width = navExpandedWidth;
                main.style.marginLeft = navExpandedWidth;
            } else {
                nav.style.width = navCollapsedWidth;
                main.style.marginLeft = navCollapsedWidth;
            }
        }
    });

    if (window.innerWidth >= 768) {
        main.style.marginLeft = navCollapsedWidth;
    }
}


async function saveData(collectionName, data, docId = null) {
    try {
        const response = await fetch('/bookshelf/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: collectionName, data: data, id: docId })
        });
        const result = await response.json();
        if (result.status === 'success') {
            await loadData();
            return result.id || docId;
        }
    } catch (error) {
        console.error(`Erro ao salvar em ${collectionName}:`, error);
        showModal("Erro ao Salvar", "Não foi possível sincronizar as alterações com o servidor.");
    }
    return null;
}

const saveBook = (bookData) => saveData('books', bookData, bookData.id);
const saveShelf = (shelfData) => saveData('shelves', shelfData, shelfData.id);
const saveProfile = (profileData) => saveData('profile', profileData);

async function saveShelvesOrder(orderedIds) {
    await saveData('shelves_order', { orderedIds });
}

async function saveBookOrder(shelfId, orderedBookIds) {
    await saveData('book_order', { shelfId, orderedBookIds });
}




async function deleteData(collectionName, docId) {
    try {
        const response = await fetch('/bookshelf/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: collectionName, id: docId })
        });
        const result = await response.json();
        if (result.status === 'success') {
            await loadData();
            hideModal();
            return true;
        }
    } catch (e) {
        console.error(e);
        showModal("Erro", "Não foi possível apagar os dados.");
    }
    return false;
}

const deleteBook = (bookId) => deleteData('books', bookId);
const deleteShelf = (shelfId) => deleteData('shelves', shelfId);

async function deleteAllBooks() {
    showModal(
        'Confirmar Exclusão Total',
        `Tem a certeza que deseja excluir <strong>TODOS</strong> os seus livros? Esta ação não pode ser desfeita.`,
        [{
            id: 'confirm-delete-all-btn', text: 'Sim, Excluir Tudo', class: 'bg-red-600 text-white', onClick: () => deleteData('all_books', 'all')
        }]
    );
}

async function addBooksToShelf(shelfId, bookIds) {
    await saveData('add_to_shelf', { shelfId, bookIds });
}

async function removeBookFromShelf(bookId, shelfId) {
    await deleteData('remove_from_shelf', { bookId, shelfId });
}

// --- Funções Auxiliares de UI e Dados ---
function getCoverUrl(book, width = 200, height = 300) {
    if (book.coverUrl && !book.coverUrl.includes('placehold.co')) {
        return book.coverUrl;
    }
    const color = book.placeholderColor || placeholderColors[Math.floor(Math.random() * placeholderColors.length)];
    const titleText = book.title ? book.title.split(' ').slice(0, 3).join(' ') : 'Sem Título';
    return `https://placehold.co/${width}x${height}/${color.bg}/${color.fg}?text=${encodeURIComponent(titleText)}`;
}


// --- Funções do Router e Renderização ---
const pages = ['estantes', 'meus-livros', 'estatisticas', 'ferramentas', 'profile', 'settings'];
function hideAllPages() {
    pages.forEach(pageId => {
        const pageEl = document.getElementById(`page-${pageId}`);
        if (pageEl) pageEl.classList.add('hidden');
    });
    const loader = document.getElementById('page-loader');
    if (loader) loader.classList.add('hidden');
}

function router() {
    if (!userId) {
        document.getElementById('page-loader')?.classList.remove('hidden');
        return;
    };

    const currentHash = window.location.hash || '#/estantes';
    const [path, param] = currentHash.substring(2).split('/');

    if (path !== 'estantes') {
        shelfPaginationState = {};
    }

    const modalRoutes = { 'book': renderDetailsInModal, 'add': renderFormInModal, 'edit': renderFormInModal };

    if (modalRoutes[path]) {
        const backgroundPageId = window.location.hash.includes('estante') ? 'page-estantes' : 'page-meus-livros';
        const backgroundPage = document.getElementById(backgroundPageId);
        if (backgroundPage) backgroundPage.classList.remove('hidden');

        modalRoutes[path](param);
        return;
    }

    if (!document.getElementById('modal-container').classList.contains('hidden')) {
        hideModal();
    }

    hideAllPages();
    updateNavLinks(currentHash);

    const fab = document.getElementById('fab-add-book');
    fab.classList.toggle('hidden', path !== 'meus-livros' && path !== 'estantes');

    if (path !== 'meus-livros') shelfSearchTerm = '';

    const targetPage = document.getElementById(`page-${path}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        switch (path) {
            case 'estantes': renderEstantes(); break;
            case 'meus-livros': renderMeusLivros(); break;
            case 'estatisticas': renderEstatisticas(); break;
            case 'ferramentas': renderFerramentas(); break;
            case 'profile': renderProfile(); break;
            case 'settings': renderSettings(); break;
            default:
                document.getElementById('page-estantes').classList.remove('hidden');
                renderEstantes();
        }
    } else {
        document.getElementById('page-estantes').classList.remove('hidden');
        renderEstantes();
    }
}

function updateNavLinks(activeHash) {
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkHash = new URL(link.href).hash;
        if (linkHash === activeHash || activeHash.startsWith(linkHash + '/')) {
            link.classList.add('text-white', 'bg-neutral-700/50');
            link.classList.remove('text-neutral-400');
        } else {
            link.classList.remove('text-white', 'bg-neutral-700/50');
            link.classList.add('text-neutral-400');
        }
    });
}

function getPageHeader(title) {
    const displayName = userProfile.name ? userProfile.name.split(' ')[0] : 'Leitor(a)';
    const avatarUrl = userProfile.avatarUrl || 'https://placehold.co/200x200/171717/FFFFFF?text=A';
    return `
        <div class="flex items-center gap-4 mb-8">
            <img src="${avatarUrl}" alt="Avatar do utilizador" class="w-16 h-16 rounded-full object-cover shadow-lg">
            <div>
                <p class="text-xl text-neutral-300">Olá, <span class="font-bold text-white">${displayName}</span>!</p>
                <h1 class="font-display text-5xl md:text-6xl">${title}</h1>
            </div>
        </div>
    `;
}

function getPaginationButtonsHtml(currentPage, totalPages) {
    let buttonsHtml = '';
    if (totalPages <= 1) {
        return '';
    }

    buttonsHtml += `<button class="pagination-btn p-2 rounded-lg" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">&lt;</button>`;

    let pagesToShow = [];
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) {
            pagesToShow.push(i);
        }
    } else {
        pagesToShow.push(1);
        if (currentPage > 3) {
            pagesToShow.push('...');
        }
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) {
            pagesToShow.push(i);
        }
        if (currentPage < totalPages - 2) {
            pagesToShow.push('...');
        }
        pagesToShow.push(totalPages);
    }

    pagesToShow = [...new Set(pagesToShow)];

    pagesToShow.forEach(page => {
        if (page === '...') {
            buttonsHtml += `<span class="px-2 flex items-center justify-center">...</span>`;
        } else {
            buttonsHtml += `<button class="pagination-btn w-10 h-10 rounded-lg ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
        }
    });

    buttonsHtml += `<button class="pagination-btn p-2 rounded-lg" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">&gt;</button>`;

    return buttonsHtml;
}

function renderEstantes() {
    const page = document.getElementById('page-estantes');
    if (!page) return;

    page.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8">
            ${getPageHeader('Estantes')}
            
            <div id="fixed-shelves-list" class="space-y-12">
                 ${fixedShelves.map(shelf => shelfSection(shelf, false)).join('')}
            </div>

            <hr class="border-neutral-800 my-12">

            <div class="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
                <button id="create-shelf-btn" class="btn-expressive btn-primary">
                    <span class="material-symbols-outlined mr-2">add</span> Criar Estante
                </button>
            </div>
            <div id="custom-shelves-list" class="space-y-12">
                ${userShelves.map(shelf => shelfSection(shelf, true)).join('')}
            </div>
        </div>
    `;

    document.getElementById('create-shelf-btn').onclick = () => {
        showModal(
            'Criar Nova Estante',
            `<input type="text" id="new-shelf-name" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" placeholder="Ex: Leituras de 2025">`,
            [{
                id: 'confirm-create-shelf', text: 'Criar', class: 'btn-primary', onClick: () => {
                    const name = document.getElementById('new-shelf-name').value.trim();
                    if (name) saveShelf({ name });
                }
            }]
        )
    };

    document.querySelectorAll('.shelf-container').forEach(shelf => {
        updateShelfPaginationView(shelf.dataset.shelfId, shelfPaginationState[shelf.dataset.shelfId] || 1);
    });

    // initSortable(); // REMOVIDO: Chamada para a função de arrastar
    attachShelfEventListeners();
}

function getBooksForShelf(shelfId) {
    const isCustomShelf = userShelves.some(s => s.id === shelfId);

    if (isCustomShelf) {
        const shelf = userShelves.find(s => s.id === shelfId);
        const booksInShelf = allBooks.filter(b => b.shelves?.includes(shelfId));
        const bookOrder = shelf.bookOrder || [];
        const bookMap = new Map(booksInShelf.map(b => [b.id, b]));

        const orderedBooks = bookOrder.map(id => bookMap.get(id)).filter(Boolean);
        const orderedBookIds = new Set(orderedBooks.map(b => b.id));
        const unorderedBooks = booksInShelf.filter(b => !orderedBookIds.has(b.id));

        return [...orderedBooks, ...unorderedBooks];
    } else {
        const allBooksInStatus = allBooks.filter(b => b.status === shelfId);
        const orderKey = `${shelfId}Order`;
        const bookOrderIds = userProfile[orderKey] || [];
        const bookMap = new Map(allBooksInStatus.map(b => [b.id, b]));

        const orderedBooks = bookOrderIds.map(id => bookMap.get(id)).filter(Boolean);
        const orderedBookIdsSet = new Set(orderedBooks.map(b => b.id));
        const remainingBooks = allBooksInStatus.filter(b => !orderedBookIdsSet.has(b.id));

        return [...orderedBooks, ...remainingBooks];
    }
}


function shelfSection(shelf, isCustom = false) {
    const booksOnShelf = getBooksForShelf(shelf.id);
    const currentPage = shelfPaginationState[shelf.id] || 1;
    const itemsPerPage = 7;
    const totalPages = Math.ceil(booksOnShelf.length / itemsPerPage);

    const bookCoversHtml = booksOnShelf.map(book => `
        <div class="relative group w-28 md:w-full flex-shrink-0 book-item" data-book-id="${book.id}">
            <a href="#/book/${book.id}" class="block">
                <img src="${getCoverUrl(book, 400, 600)}" alt="Capa de ${book.title}" class="w-full rounded-md shadow-lg aspect-[2/3] object-cover transition-transform duration-200 group-hover:scale-105 group-hover:shadow-xl">
            </a>
            ${isCustom ? `
            <button data-book-id="${book.id}" data-shelf-id="${shelf.id}" class="remove-from-shelf-btn absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 items-center justify-center shadow-lg hover:bg-red-700 transition-all z-10 hidden group-hover:flex" title="Remover da estante">
                <span class="material-symbols-outlined !text-base">close</span>
            </button>` : ''}
        </div>
    `).join('');

    const paginationHtml = totalPages > 1 ? `
        <div class="hidden md:flex justify-center items-center gap-2 mt-4 shelf-pagination" data-shelf-id="${shelf.id}" data-is-custom="${isCustom}">
           ${getPaginationButtonsHtml(currentPage, totalPages)}
        </div>
    ` : '';

    return `
        <div class="card-expressive p-6 shelf-container" data-shelf-id="${shelf.id}">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h2 class="font-display text-2xl">${shelf.name}</h2>
                    <p class="text-sm text-neutral-400">${booksOnShelf.length} ${booksOnShelf.length === 1 ? 'livro' : 'livros'}</p>
                </div>
                <div class="flex items-center gap-2">
                     ${isCustom ? `
                        <button class="add-book-to-shelf-btn btn-expressive !h-10 !w-10 !p-0 !rounded-full btn-tonal" data-shelf-id="${shelf.id}" title="Adicionar livro a esta estante">
                            <span class="material-symbols-outlined">add</span>
                        </button>
                        <button class="delete-shelf-btn text-neutral-500 hover:text-red-500" data-shelf-id="${shelf.id}" title="Apagar estante">
                            <span class="material-symbols-outlined">delete</span>
                        </button>`
            : ''}
                </div>
            </div>
            <div class="book-list-wrapper">
                <div class="book-list flex gap-4 overflow-x-auto p-4 md:grid md:grid-cols-7 md:overflow-visible" data-shelf-id="${shelf.id}">
                    ${booksOnShelf.length > 0 ? bookCoversHtml : `<p class="text-neutral-500 md:col-span-7 text-center">${isCustom ? 'Adicione livros a esta estante clicando no botão +.' : 'Nenhum livro com este status.'}</p>`}
                </div>
                ${paginationHtml}
            </div>
        </div>`;
}

function updateShelfPaginationView(shelfId, page) {
    const shelfContainer = document.querySelector(`.shelf-container[data-shelf-id="${shelfId}"]`);
    if (!shelfContainer) return;

    const bookItems = shelfContainer.querySelectorAll('.book-item');
    const itemsPerPage = 7;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    bookItems.forEach((item, index) => {
        const shouldBeHidden = !(index >= startIndex && index < endIndex);
        item.classList.toggle('pag-hidden', shouldBeHidden);
    });

    const paginationContainer = shelfContainer.querySelector('.shelf-pagination');
    if (paginationContainer) {
        const totalPages = Math.ceil(bookItems.length / itemsPerPage);
        paginationContainer.innerHTML = getPaginationButtonsHtml(page, totalPages);

        // Reatribui os eventos de clique aos novos botões
        paginationContainer.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.onclick = (e) => {
                const shelfId = e.target.closest('.shelf-pagination').dataset.shelfId;
                const newPage = parseInt(e.target.dataset.page, 10);
                shelfPaginationState[shelfId] = newPage;
                updateShelfPaginationView(shelfId, newPage);
            };
        });
    }
}


function attachShelfEventListeners() {
    document.querySelectorAll('.delete-shelf-btn').forEach(btn => {
        btn.onclick = () => {
            const shelfId = btn.dataset.shelfId;
            const shelf = userShelves.find(s => s.id === shelfId);
            if (shelf) showModal('Confirmar Exclusão', `Tem a certeza que deseja excluir a estante "<strong>${shelf.name}</strong>"?`, [{ id: 'confirm-delete-shelf', text: 'Sim, Excluir', class: 'bg-red-600 text-white', onClick: () => deleteShelf(shelfId) }]);
        }
    });

    document.querySelectorAll('.add-book-to-shelf-btn').forEach(btn => {
        btn.onclick = () => showAddBookToShelfModal(btn.dataset.shelfId);
    });

    document.querySelectorAll('.remove-from-shelf-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { bookId, shelfId } = e.currentTarget.dataset;
            removeBookFromShelf(bookId, shelfId);
        };
    });

    document.querySelectorAll('.shelf-pagination .pagination-btn').forEach(btn => {
        btn.onclick = (e) => {
            const shelfPaginationDiv = e.target.closest('.shelf-pagination');
            if (!shelfPaginationDiv) return;

            const shelfId = shelfPaginationDiv.dataset.shelfId;
            const page = parseInt(e.target.dataset.page, 10);

            shelfPaginationState[shelfId] = page;
            updateShelfPaginationView(shelfId, page);
        }
    });
}

function showAddBookToShelfModal(shelfId) {
    const shelf = userShelves.find(s => s.id === shelfId);
    if (!shelf) return;

    const booksNotInShelf = allBooks.filter(book => !book.shelves?.includes(shelfId));

    const content = booksNotInShelf.length > 0 ?
        `<div class="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-80 overflow-y-auto pr-2">
            ${booksNotInShelf.map(book => `
                <label class="book-cover-selector aspect-[2/3] relative cursor-pointer">
                    <input type="checkbox" name="add-books" value="${book.id}" class="sr-only peer">
                    <img src="${getCoverUrl(book)}" alt="${book.title}" class="w-full h-full object-cover rounded-lg shadow-md transition-all">
                </label>`).join('')}
        </div>` :
        '<p class="text-center text-neutral-400">Todos os seus livros já estão nesta estante.</p>';

    const actions = booksNotInShelf.length > 0 ? [{
        id: 'confirm-add-books', text: 'Adicionar Selecionados', class: 'btn-primary', onClick: () => {
            const selectedBookIds = Array.from(document.querySelectorAll('input[name="add-books"]:checked')).map(cb => cb.value);
            if (selectedBookIds.length > 0) {
                addBooksToShelf(shelfId, selectedBookIds);
            }
        }
    }] : [];

    showModal(`Adicionar à Estante: ${shelf.name}`, content, actions);
}


function renderMeusLivros() {
    const page = document.getElementById('page-meus-livros');
    page.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8">
            ${getPageHeader('Os Meus Livros')}
            <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">search</span>
                <input type="search" id="book-search-input" placeholder="Pesquisar em todos os livros..." class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl py-3 pl-10 pr-4" value="${shelfSearchTerm}">
            </div>
            <div id="filter-container"></div>
            <div id="shelf-content" class="space-y-4"></div>
            <div id="pagination-controls" class="mt-8"></div>
        </div>`;

    renderShelfContent();

    const searchInput = document.getElementById('book-search-input');
    searchInput.oninput = (e) => {
        shelfSearchTerm = e.target.value;
        currentPage = 1;
        renderShelfContent();
    };
}

function renderShelfContent() {
    const contentContainer = document.getElementById('shelf-content');
    if (!contentContainer) return;

    let filteredBooks = [...allBooks].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    if (shelfSearchTerm) {
        const lowerCaseSearch = shelfSearchTerm.toLowerCase();
        filteredBooks = filteredBooks.filter(book =>
            book.title.toLowerCase().includes(lowerCaseSearch) ||
            (book.author || '').toLowerCase().includes(lowerCaseSearch)
        );
    }

    const counts = {
        todos: filteredBooks.length,
        lendo: filteredBooks.filter(b => b.status === 'lendo').length,
        lido: filteredBooks.filter(b => b.status === 'lido').length,
        'quero-ler': filteredBooks.filter(b => b.status === 'quero-ler').length,
        abandonado: filteredBooks.filter(b => b.status === 'abandonado').length,
        favorito: filteredBooks.filter(b => b.favorite).length,
        comCapa: filteredBooks.filter(b => b.coverUrl && !b.coverUrl.includes('placehold.co')).length,
        semCapa: filteredBooks.filter(b => !b.coverUrl || b.coverUrl.includes('placehold.co')).length
    };

    const filterContainer = document.getElementById('filter-container');
    const statusMap = { todos: 'Todos', lendo: 'Lendo Agora', lido: 'Lidos', abandonado: 'Abandonados', 'quero-ler': 'Quero Ler', favorito: 'Favoritos', comCapa: 'Com Capa', semCapa: 'Sem Capa' };
    if (filterContainer) {
        filterContainer.innerHTML = `<div class="segmented-btn-container flex-wrap flex gap-2">
            ${Object.keys(statusMap).map(key => `
                <button data-filter="${key}" class="filter-btn btn-expressive py-2 px-4 h-auto text-sm ${currentFilter === key ? 'active' : ''}">
                    ${statusMap[key]} (${counts[key] || 0})
                </button>
            `).join('')}
        </div>`;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.onclick = (e) => {
                currentFilter = e.currentTarget.dataset.filter;
                currentPage = 1;
                renderShelfContent();
            };
        });
    }

    filteredBooks = filteredBooks.filter(book => {
        if (currentFilter === 'todos') return true;
        if (currentFilter === 'favorito') return book.favorite;
        if (currentFilter === 'comCapa') return book.coverUrl && !book.coverUrl.includes('placehold.co');
        if (currentFilter === 'semCapa') return !book.coverUrl || book.coverUrl.includes('placehold.co');
        return book.status === currentFilter;
    });

    const totalItems = filteredBooks.length;
    const totalPages = itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

    const paginatedBooks = filteredBooks.slice((currentPage - 1) * itemsPerPage, itemsPerPage > 0 ? ((currentPage - 1) * itemsPerPage) + itemsPerPage : totalItems);

    if (paginatedBooks.length > 0) {
        contentContainer.innerHTML = paginatedBooks.map(bookCard).join('');
    } else {
        contentContainer.innerHTML = `
            <div class="text-center py-20 card-expressive">
                <span class="material-symbols-outlined text-6xl text-neutral-500 mb-4">search_off</span>
                <h3 class="text-xl font-bold">Nenhum livro encontrado</h3>
                <p class="text-neutral-400">Tente um filtro ou termo de busca diferente.</p>
            </div>`;
    }
    renderPaginationControls(totalPages, totalItems);
}

function bookCard(book) {
    const ratingHtml = Array.from({ length: 5 }, (_, i) => `<span class="material-symbols-outlined !text-xl ${i < book.rating ? 'filled text-amber-400' : 'text-neutral-600'}">star</span>`).join('');
    const feelingsHtml = book.feelings?.length > 0 ? `<div class="flex flex-wrap gap-1 mt-2 justify-center sm:justify-start">${book.feelings.slice(0, 5).map(f => `<span class="mood-tag-pill text-xs font-bold px-2 py-0.5 rounded-full capitalize">${f}</span>`).join('')}</div>` : '';
    return `<a href="#/book/${book.id}" class="book-card-link card-expressive p-4 flex flex-col sm:flex-row gap-4 no-underline hover:bg-[hsl(var(--md-sys-color-surface-container-highest))]">
            <div class="w-1/3 sm:w-1/5 flex-shrink-0 mx-auto"><img src="${getCoverUrl(book)}" alt="Capa de ${book.title}" class="w-full rounded-lg shadow-lg aspect-[2/3] object-cover"></div>
            <div class="flex flex-col flex-grow text-center sm:text-left text-current">
                <h2 class="font-display text-xl lg:text-2xl title-text-shadow font-bold leading-tight">${book.title}</h2>
                <p class="text-sm text-neutral-400 mb-2">${book.author || 'Autor desconhecido'}</p>
                <div class="flex items-center justify-center sm:justify-start gap-1 mb-2">${ratingHtml}</div>
                ${feelingsHtml}
                <div class="mt-auto pt-4"><div class="btn-expressive btn-primary !h-10 !text-sm flex-1 flex items-center justify-center gap-2"><span class="material-symbols-outlined !text-base">visibility</span>Ver Detalhes</div></div>
            </div>
        </a>`;
}

function renderPaginationControls(totalPages, totalItems) {
    const controlsContainer = document.getElementById('pagination-controls');
    if (!controlsContainer) return;

    const itemsPerPageOptions = [10, 20, 50, 100];

    controlsContainer.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-2">
                <label for="items-per-page" class="text-sm text-neutral-400">Itens por pág:</label>
                <select id="items-per-page" class="bg-neutral-800 border-2 border-neutral-700 rounded-lg p-1 text-sm">
                    ${itemsPerPageOptions.map(opt => `<option value="${opt}" ${itemsPerPage === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                    <option value="999999" ${itemsPerPage >= totalItems && totalItems > 0 ? 'selected' : ''}>Todos</option>
                </select>
            </div>
            <div id="page-buttons" class="flex items-center gap-1">
            </div>
        </div>
    `;

    const pageButtonsContainer = document.getElementById('page-buttons');
    if (pageButtonsContainer) {
        pageButtonsContainer.innerHTML = getPaginationButtonsHtml(currentPage, totalPages);
    }

    document.getElementById('items-per-page').onchange = (e) => {
        itemsPerPage = Number(e.target.value);
        currentPage = 1;
        renderShelfContent();
    };

    document.querySelectorAll('#page-buttons .pagination-btn').forEach(button => {
        button.onclick = (e) => {
            currentPage = Number(e.currentTarget.dataset.page);
            renderShelfContent();
        };
    });
}


function renderEstatisticas() {
    const page = document.getElementById('page-estatisticas');
    const readBooks = allBooks.filter(b => b.status === 'lido');
    const totalPagesRead = readBooks.reduce((sum, b) => sum + (Number(b.totalPages || b.pages) || 0), 0);
    const validRatings = readBooks.filter(b => b.rating && b.rating > 0);
    const avgRating = validRatings.length > 0 ? (validRatings.reduce((sum, b) => sum + b.rating, 0) / validRatings.length).toFixed(1) : 'N/A';

    page.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8">
            ${getPageHeader('Estatísticas')}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="card-expressive p-6"><h2 class="text-lg font-bold text-neutral-400">Livros Lidos</h2><p class="font-display text-6xl text-white">${readBooks.length}</p></div>
                <div class="card-expressive p-6"><h2 class="text-lg font-bold text-neutral-400">Páginas Lidas</h2><p class="font-display text-6xl text-white">${totalPagesRead.toLocaleString('pt-BR')}</p></div>
                <div class="card-expressive p-6"><h2 class="text-lg font-bold text-neutral-400">Média de Estrelas</h2><p class="font-display text-6xl text-white">${avgRating}</p></div>
            </div>
        </div>`;
}

// NOVA FUNÇÃO PARA A PÁGINA DE FERRAMENTAS
function renderFerramentas() {
    const page = document.getElementById('page-ferramentas');
    if (!page) return;

    page.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8">
            ${getPageHeader('Ferramentas')}
            
            <!-- Calculadora de Audiobook -->
            <div class="card-expressive p-6">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="font-display text-2xl">Calculadora de Audiolivro</h2>
                        <p class="text-sm text-neutral-400">Calcule o seu progresso de leitura em áudio.</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <!-- Inputs -->
                    <div class="space-y-4">
                        <div>
                            <h3 class="font-bold text-neutral-300 mb-2">Tempo TOTAL do Audiolivro</h3>
                            <div class="grid grid-cols-3 gap-2">
                                <input type="number" id="total-h" placeholder="Horas" class="audio-calc-input w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3 text-center" min="0">
                                <input type="number" id="total-m" placeholder="Minutos" class="audio-calc-input w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3 text-center" min="0" max="59">
                                <input type="number" id="total-s" placeholder="Segundos" class="audio-calc-input w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3 text-center" min="0" max="59">
                            </div>
                        </div>
                        <div>
                            <h3 class="font-bold text-neutral-300 mb-2">Tempo LIDO do Audiolivro</h3>
                            <div class="grid grid-cols-3 gap-2">
                                <input type="number" id="read-h" placeholder="Horas" class="audio-calc-input w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3 text-center" min="0">
                                <input type="number" id="read-m" placeholder="Minutos" class="audio-calc-input w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3 text-center" min="0" max="59">
                                <input type="number" id="read-s" placeholder="Segundos" class="audio-calc-input w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3 text-center" min="0" max="59">
                            </div>
                        </div>
                    </div>

                    <!-- Resultado -->
                    <div class="text-center bg-[hsl(var(--md-sys-color-surface))] p-8 rounded-2xl">
                        <p class="text-lg font-bold text-neutral-400">Progresso</p>
                        <p id="audio-result" class="font-display text-6xl text-[hsl(var(--md-sys-color-primary))]">0.00%</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Adiciona os 'event listeners' para que a calculadora funcione em tempo real
    document.querySelectorAll('.audio-calc-input').forEach(input => {
        input.addEventListener('input', calculateAudiobookPercentage);
    });
}

// NOVA FUNÇÃO PARA A LÓGICA DA CALCULADORA
function calculateAudiobookPercentage() {
    const getSeconds = (h, m, s) => {
        const hours = parseInt(document.getElementById(h).value) || 0;
        const minutes = parseInt(document.getElementById(m).value) || 0;
        const seconds = parseInt(document.getElementById(s).value) || 0;
        return (hours * 3600) + (minutes * 60) + seconds;
    };

    const totalSeconds = getSeconds('total-h', 'total-m', 'total-s');
    const readSeconds = getSeconds('read-h', 'read-m', 'read-s');
    const resultElement = document.getElementById('audio-result');

    if (!resultElement) return;

    if (totalSeconds === 0) {
        resultElement.textContent = '0.00%';
        return;
    }

    let percentage = (readSeconds / totalSeconds) * 100;

    if (percentage > 100) {
        percentage = 100;
    }
    if (percentage < 0) {
        percentage = 0;
    }

    resultElement.textContent = percentage.toFixed(2) + '%';
}


function renderProfile() {
    const page = document.getElementById('page-profile');
    const avatarUrls = [
        'https://rodcarvalho.com/2.png',
        'https://rodcarvalho.com/1.png',
        'https://rodcarvalho.com/3.png',
        'https://rodcarvalho.com/4.png'
    ];
    const googlePhotoUrl = null;

    page.innerHTML = `
        <div class="max-w-2xl mx-auto space-y-8">
            ${getPageHeader('O Meu Perfil')}
            <form id="profile-form" class="space-y-8">
                 <div class="card-expressive p-6">
                    <h2 class="text-xl font-bold mb-4 text-[hsl(var(--md-sys-color-primary))]">O seu Avatar</h2>
                    <input type="hidden" id="avatarUrl" value="${userProfile.avatarUrl || ''}">
                    <div id="avatar-selector" class="flex justify-center flex-wrap gap-4">
                        ${googlePhotoUrl ? `<img src="${googlePhotoUrl}" data-url="${googlePhotoUrl}" class="avatar-option w-24 h-24 rounded-full object-cover cursor-pointer border-4 border-transparent hover:border-[hsl(var(--md-sys-color-primary))] transition-all ${userProfile.avatarUrl === googlePhotoUrl ? '!border-[hsl(var(--md-sys-color-primary))]' : ''}" title="Usar foto do Google">` : ''}
                        ${avatarUrls.map(url => `
                            <img src="${url}" 
                                 data-url="${url}"
                                 class="avatar-option w-24 h-24 rounded-full object-cover cursor-pointer border-4 border-transparent hover:border-[hsl(var(--md-sys-color-primary))] transition-all
                                 ${userProfile.avatarUrl === url ? '!border-[hsl(var(--md-sys-color-primary))]' : ''}">
                        `).join('')}
                    </div>
                     <p class="text-xs text-neutral-500 mt-4 text-center">Para alterar a sua foto de perfil, <a href="https://myaccount.google.com/" target="_blank" class="text-[hsl(var(--md-sys-color-primary))] hover:underline">atualize na sua Conta Google</a>.</p>
                </div>
            
                <div class="card-expressive p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div class="md:col-span-2">
                        <label for="profile-name" class="block text-sm font-bold mb-2 text-neutral-300">Nome</label>
                        <input type="text" id="profile-name" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${userProfile.name || ''}" placeholder="O seu nome de exibição">
                    </div>
                    <div>
                        <label for="profile-pronouns" class="block text-sm font-bold mb-2 text-neutral-300">Pronomes</label>
                        <input type="text" id="profile-pronouns" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${userProfile.pronouns || ''}" placeholder="ela/dela, ele/dele">
                    </div>
                    <div>
                        <label for="profile-blog" class="block text-sm font-bold mb-2 text-neutral-300">Blog / Site</label>
                        <input type="url" id="profile-blog" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${userProfile.blog || ''}" placeholder="https://...">
                    </div>
                    <div>
                        <label for="profile-instagram" class="block text-sm font-bold mb-2 text-neutral-300">Instagram</label>
                        <input type="text" id="profile-instagram" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${userProfile.instagram || ''}" placeholder="@usuario">
                    </div>
                     <div>
                        <label for="profile-youtube" class="block text-sm font-bold mb-2 text-neutral-300">YouTube</label>
                        <input type="text" id="profile-youtube" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${userProfile.youtube || ''}" placeholder="@canal">
                    </div>
                </div>
                
                 <div class="flex items-center justify-end gap-4 pt-4">
                    <button type="submit" class="btn-expressive btn-primary">
                        <span class="material-symbols-outlined mr-2">save</span> Salvar Perfil
                    </button>
                </div>
            </form>
        </div>`;

    document.querySelectorAll('.avatar-option').forEach(img => {
        img.onclick = () => {
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('!border-[hsl(var(--md-sys-color-primary))]'));
            img.classList.add('!border-[hsl(var(--md-sys-color-primary))]');
            document.getElementById('avatarUrl').value = img.dataset.url;
        }
    });

    document.getElementById('profile-form').onsubmit = (e) => {
        e.preventDefault();
        saveProfile({
            avatarUrl: document.getElementById('avatarUrl').value,
            name: document.getElementById('profile-name').value,
            pronouns: document.getElementById('profile-pronouns').value,
            blog: document.getElementById('profile-blog').value,
            instagram: document.getElementById('profile-instagram').value,
            youtube: document.getElementById('profile-youtube').value,
        });
    };
}

function renderSettings() {
    const page = document.getElementById('page-settings');
    const savedTheme = userProfile.theme || localStorage.getItem('bookTrackerTheme') || 'dark';

    page.innerHTML = `
         <div class="max-w-2xl mx-auto space-y-8">
            ${getPageHeader('Configurações')}
            <div class="card-expressive p-6">
                <h2 class="text-xl font-bold mb-2 text-[hsl(var(--md-sys-color-primary))]">Aparência</h2>
                <label for="theme-selector" class="block text-sm font-bold mb-2 text-neutral-300">Tema do Aplicativo</label>
                <select id="theme-selector" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3 focus:border-[hsl(var(--md-sys-color-primary))] focus:ring-0">
                    ${themeOrder.map(key => `<option value="${key}" ${savedTheme === key ? 'selected' : ''}>${themes[key].name}</option>`).join('')}
                </select>
            </div>
            
            <div class="card-expressive p-6">
                <h2 class="text-xl font-bold mb-2 text-[hsl(var(--md-sys-color-primary))]">Gerir Dados</h2>
                <div class="flex flex-col sm:flex-row gap-4">
                    <button id="import-csv-btn" class="btn-expressive btn-text flex-1"><span class="material-symbols-outlined mr-2">upload</span> Importar CSV</button>
                    <input type="file" id="csv-file-input" class="hidden" accept=".csv">
                    <button id="export-csv-btn" class="btn-expressive btn-text flex-1"><span class="material-symbols-outlined mr-2">download</span> Exportar CSV</button>
                </div>
            </div>

            <div class="card-expressive p-6">
                <h2 class="text-xl font-bold mb-2 text-[hsl(var(--md-sys-color-primary))]">Sessão</h2>
                <p class="text-neutral-300 mb-4">Você está ligado. Para sair, clique no botão abaixo.</p>
                <button id="logout-btn" class="btn-expressive btn-tonal w-full">Sair da Conta</button>
            </div>

            <div class="card-expressive p-6 border-l-4 border-red-500">
                <h2 class="text-xl font-bold mb-2 text-red-400">Zona de Perigo</h2>
                 <p class="text-neutral-300 mb-4">A ação abaixo é irreversível. Tenha a certeza do que está a fazer.</p>
                <button id="delete-all-books-btn" class="btn-expressive bg-red-800/80 hover:bg-red-800 text-white w-full">Deletar Todos os Livros</button>
            </div>
         </div>`;
    document.getElementById('theme-selector').onchange = (e) => applyTheme(e.target.value);
    document.getElementById('import-csv-btn').onclick = () => document.getElementById('csv-file-input').click();
    document.getElementById('csv-file-input').onchange = handleCsvImport;
    document.getElementById('export-csv-btn').onclick = handleCsvExport;
    document.getElementById('logout-btn').onclick = () => { window.location.href = '/logout'; };
    document.getElementById('delete-all-books-btn').onclick = () => { showModal('Confirmar Exclusão Total', 'Tem a certeza?', [{ id: 'confirm-delete-all-btn', text: 'Sim, Excluir Tudo', class: 'bg-red-600 text-white', onClick: deleteAllBooks }]); };
}

async function renderFormInModal(bookId = null, initialData = null) {
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    let book = {};
    const isEditing = bookId !== null;

    if (initialData) {
        book = initialData;
    } else if (isEditing) {
        book = allBooks.find(b => b.id === bookId) || {};
    }

    const selectedFeelings = book.feelings || [];
    const bookShelves = book.shelves || [];

    const formHtml = `
        <div class="card-expressive w-full max-w-5xl max-h-[90vh] flex flex-col relative">
            <button id="modal-close-btn" class="absolute top-4 right-5 text-neutral-400 hover:text-white text-4xl leading-none z-10">&times;</button>
            <div class="p-6 md:p-8 flex-grow overflow-y-auto">
                <form id="book-form" class="space-y-6">
                    <h1 class="font-display text-3xl md:text-4xl mb-6">${isEditing ? 'Editar Livro' : 'Adicionar Novo Livro'}</h1>
                    <input type="hidden" id="bookId" value="${book.id || ''}">
                    
                    <div class="card-expressive p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="md:col-span-2"><label for="title" class="block text-sm font-bold mb-2 text-neutral-300">Título</label><div class="flex items-center gap-2"><input type="text" id="title" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${book.title || ''}" required><button type="button" id="metadata-search-btn" class="btn-expressive btn-tonal h-auto py-2 px-3 shrink-0">Procurar</button></div></div>
                        <div class="md:col-span-2 flex justify-center"><div id="cover-preview-container" class="mt-4">${book.coverUrl ? `<img src="${getCoverUrl(book)}" class="w-32 rounded-lg shadow-md">` : ''}</div></div>
                        <div><label for="author" class="block text-sm font-bold mb-2 text-neutral-300">Autor</label><input type="text" id="author" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${book.author || ''}" required></div>
                        <div><label for="isbn" class="block text-sm font-bold mb-2 text-neutral-300">ISBN</label><input type="text" id="isbn" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${book.isbn || ''}"></div>
                        <div class="md:col-span-2"><label for="coverUrl" class="block text-sm font-bold mb-2 text-neutral-300">URL da Capa</label><input type="url" id="coverUrl" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${book.coverUrl || ''}"></div>
                    </div>
                    
                    <div class="card-expressive p-6 space-y-4">
                        <h3 class="text-xl font-bold text-[hsl(var(--md-sys-color-primary))]">Estantes</h3>
                        <div id="shelf-selection-container" class="max-h-40 overflow-y-auto space-y-2 pr-2">
                            ${userShelves.length > 0 ? userShelves.map(shelf => `<label class="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-800/50 cursor-pointer"><input type="checkbox" name="shelves" value="${shelf.id}" class="h-5 w-5 rounded bg-neutral-700 border-neutral-600 text-[hsl(var(--md-sys-color-primary))] focus:ring-0" ${bookShelves.includes(shelf.id) ? 'checked' : ''}><span>${shelf.name}</span></label>`).join('') : '<p class="text-neutral-400">Nenhuma estante criada ainda.</p>'}
                        </div>
                        <div class="flex items-center gap-2 pt-2 border-t border-neutral-700/50"><input type="text" id="new-shelf-name-inline" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-2 text-sm" placeholder="Nome da nova estante"><button type="button" id="add-new-shelf-inline-btn" class="btn-expressive btn-tonal !h-auto !py-2 !px-3 !text-xs">Criar e Adicionar</button></div>
                    </div>

                    <div class="card-expressive p-6 space-y-4"><h3 class="text-xl font-bold text-[hsl(var(--md-sys-color-primary))]">Como este livro o fez sentir?</h3><div id="feelings-container" class="flex flex-wrap gap-2">${sentimentos.map(s => `<button type="button" data-feeling="${s}" class="mood-tag-btn btn-expressive !py-1 !px-3 !h-auto !text-xs capitalize ${selectedFeelings.includes(s) ? 'selected' : ''}">${s}</button>`).join('')}</div><input type="hidden" id="feelingsValue" value="${selectedFeelings.join(',') || ''}"></div>

                    <div class="card-expressive p-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                             <div><label for="status" class="block text-sm font-bold mb-2 text-neutral-300">Status</label><select id="status" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3"><option value="quero-ler" ${book.status === 'quero-ler' ? 'selected' : ''}>Quero Ler</option><option value="lendo" ${book.status === 'lendo' ? 'selected' : ''}>Lendo Agora</option><option value="lido" ${book.status === 'lido' ? 'selected' : ''}>Lido</option><option value="abandonado" ${book.status === 'abandonado' ? 'selected' : ''}>Abandonado</option></select></div>
                             <div><label class="block text-sm font-bold mb-2 text-neutral-300">Avaliação & Favorito</label><div class="flex items-center gap-4"><div id="rating" class="flex items-center gap-1">${[1, 2, 3, 4, 5].map(i => `<span class="material-symbols-outlined star-icon !text-3xl cursor-pointer transition-colors ${Number(book.rating) >= i ? 'filled text-amber-400' : 'text-neutral-600'}" data-value="${i}">star</span>`).join('')}</div><input type="hidden" id="ratingValue" value="${book.rating || 0}"><button type="button" id="favorite-btn" class="text-neutral-500 hover:text-red-500 transition-colors"><span class="material-symbols-outlined !text-3xl ${book.favorite ? 'filled text-red-500' : ''}">favorite</span></button><input type="hidden" id="favoriteValue" value="${book.favorite ? 'true' : 'false'}"></div></div>
                             <div><label for="startDate" class="block text-sm font-bold mb-2 text-neutral-300">Data de Início</label><input type="date" id="startDate" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${book.startDate || ''}"></div>
                             <div><label for="endDate" class="block text-sm font-bold mb-2 text-neutral-300">Data de Conclusão</label><input type="date" id="endDate" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${book.endDate || ''}"></div>
                             <div class="md:col-span-2 grid grid-cols-3 gap-4"><label class="text-center cursor-pointer p-3 rounded-xl has-[:checked]:bg-[hsl(var(--md-sys-color-primary-container))] border-2 border-transparent has-[:checked]:border-[hsl(var(--md-sys-color-primary))]"><span class="material-symbols-outlined mb-1">auto_stories</span><span class="block text-sm font-bold">Físico</span><input type="radio" name="mediaType" value="fisico" ${!book.mediaType || book.mediaType === 'fisico' ? 'checked' : ''} class="sr-only"></label><label class="text-center cursor-pointer p-3 rounded-xl has-[:checked]:bg-[hsl(var(--md-sys-color-primary-container))] border-2 border-transparent has-[:checked]:border-[hsl(var(--md-sys-color-primary))]"><span class="material-symbols-outlined mb-1">tablet_mac</span><span class="block text-sm font-bold">Digital</span><input type="radio" name="mediaType" value="digital" ${book.mediaType === 'digital' ? 'checked' : ''} class="sr-only"></label><label class="text-center cursor-pointer p-3 rounded-xl has-[:checked]:bg-[hsl(var(--md-sys-color-primary-container))] border-2 border-transparent has-[:checked]:border-[hsl(var(--md-sys-color-primary))]"><span class="material-symbols-outlined mb-1">headphones</span><span class="block text-sm font-bold">Audiolivro</span><input type="radio" name="mediaType" value="audiobook" ${book.mediaType === 'audiobook' ? 'checked' : ''} class="sr-only"></label></div>
                             <div id="total-pages-container" class="md:col-span-1"><label for="totalPages" class="block text-sm font-bold mb-2 text-neutral-300">Nº de Páginas</label><input type="number" id="totalPages" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${book.totalPages || book.pages || ''}"></div>
                             <div id="total-time-container" class="hidden md:col-span-1"><label for="totalTime" class="block text-sm font-bold mb-2 text-neutral-300">Tempo Total (HH:MM)</label><input type="text" id="totalTime" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${book.totalTime || ''}" placeholder="01:30"></div>
                        </div>
                    </div>
                    
                    <div class="card-expressive p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label for="synopsis" class="block text-sm font-bold mb-2 text-neutral-300">Sinopse</label><textarea id="synopsis" rows="6" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3">${book.synopsis || ''}</textarea></div>
                        <div><label for="review" class="block text-sm font-bold mb-2 text-neutral-300">A Minha Resenha</label><textarea id="review" rows="6" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3">${book.review || ''}</textarea></div>
                        <div class="md:col-span-2"><label for="categories" class="block text-sm font-bold mb-2 text-neutral-300">Categorias (separadas por vírgula)</label><input type="text" id="categories" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${(book.categories || []).join(', ')}"></div>
                    </div>
                    
                    <div class="flex items-center justify-end gap-4 pt-4">
                         <button type="button" class="btn-expressive btn-text" id="form-cancel-btn">Cancelar</button>
                        <button type="submit" class="btn-expressive btn-primary"><span class="material-symbols-outlined mr-2">save</span> ${isEditing ? 'Salvar Alterações' : 'Adicionar Livro'}</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    modalContent.innerHTML = formHtml;
    modalContainer.classList.remove('hidden');

    document.getElementById('modal-close-btn').onclick = hideModal;
    modalContainer.onclick = hideModal;
    modalContent.firstElementChild.onclick = (e) => e.stopPropagation();

    setupFormListeners(modalContent);
    document.addEventListener('keydown', handleEscKey);
}

function setupFormListeners(container = document) {
    const stars = container.querySelectorAll('.star-icon');
    stars.forEach(star => { star.onclick = () => { const rating = star.dataset.value; container.getElementById('ratingValue').value = rating; stars.forEach(s => { s.classList.toggle('filled', s.dataset.value <= rating); s.classList.toggle('text-amber-400', s.dataset.value <= rating); s.classList.toggle('text-neutral-600', s.dataset.value > rating); }); }; });
    const favBtn = container.querySelector('#favorite-btn');
    favBtn.onclick = () => { const isFavorite = container.querySelector('#favoriteValue').value === 'true'; container.querySelector('#favoriteValue').value = !isFavorite; favBtn.querySelector('span').classList.toggle('filled', !isFavorite); favBtn.querySelector('span').classList.toggle('text-red-500', !isFavorite); };
    const feelingsContainer = container.querySelector('#feelings-container');
    if (feelingsContainer) { feelingsContainer.addEventListener('click', (e) => { if (e.target.matches('.mood-tag-btn')) { e.preventDefault(); const btn = e.target; const feeling = btn.dataset.feeling; let selectedFeelings = container.querySelector('#feelingsValue').value ? container.querySelector('#feelingsValue').value.split(',').filter(f => f) : []; if (selectedFeelings.includes(feeling)) { selectedFeelings = selectedFeelings.filter(f => f !== feeling); btn.classList.remove('selected'); } else { if (selectedFeelings.length < 5) { selectedFeelings.push(feeling); btn.classList.add('selected'); } } container.querySelector('#feelingsValue').value = selectedFeelings.join(','); } }); }
    const mediaTypeRadios = container.querySelectorAll('input[name="mediaType"]');
    function toggleMediaFields() { const selectedType = container.querySelector('input[name="mediaType"]:checked').value; container.querySelector('#total-pages-container').classList.toggle('hidden', selectedType === 'audiobook'); container.querySelector('#total-time-container').classList.toggle('hidden', selectedType !== 'audiobook'); }
    mediaTypeRadios.forEach(radio => radio.onchange = toggleMediaFields);
    toggleMediaFields();

    const addNewShelfBtn = container.querySelector('#add-new-shelf-inline-btn');
    if (addNewShelfBtn) {
        addNewShelfBtn.onclick = async () => {
            const input = container.querySelector('#new-shelf-name-inline');
            const newShelfName = input.value.trim();
            if (newShelfName) {
                const newShelfId = await saveShelf({ name: newShelfName });
                if (newShelfId) {
                    const shelfSelectionContainer = container.querySelector('#shelf-selection-container');
                    const newCheckboxHtml = `<label class="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-800/50 cursor-pointer"><input type="checkbox" name="shelves" value="${newShelfId}" class="h-5 w-5 rounded" checked><span>${newShelfName}</span></label>`;
                    const noShelfMsg = shelfSelectionContainer.querySelector('p');
                    if (noShelfMsg) noShelfMsg.remove();
                    shelfSelectionContainer.insertAdjacentHTML('beforeend', newCheckboxHtml);
                    input.value = '';
                }
            }
        };
    }

    container.querySelector('#book-form').onsubmit = async (e) => {
        e.preventDefault();
        const selectedShelves = Array.from(container.querySelectorAll('input[name="shelves"]:checked')).map(cb => cb.value);
        const bookData = {
            id: container.querySelector('#bookId').value || null,
            title: container.querySelector('#title').value,
            author: container.querySelector('#author').value,
            status: container.querySelector('#status').value,
            rating: Number(container.querySelector('#ratingValue').value) || 0,
            startDate: container.querySelector('#startDate').value,
            endDate: container.querySelector('#endDate').value,
            isbn: container.querySelector('#isbn').value,
            coverUrl: container.querySelector('#coverUrl').value,
            synopsis: container.querySelector('#synopsis').value,
            review: container.querySelector('#review').value,
            categories: container.querySelector('#categories').value ? container.querySelector('#categories').value.split(',').map(c => c.trim()) : [],
            favorite: container.querySelector('#favoriteValue').value === 'true',
            mediaType: container.querySelector('input[name="mediaType"]:checked').value,
            totalPages: Number(container.querySelector('#totalPages').value) || 0,
            totalTime: container.querySelector('#totalTime').value || '',
            feelings: container.querySelector('#feelingsValue').value ? container.querySelector('#feelingsValue').value.split(',').filter(f => f) : [],
            shelves: selectedShelves,
        };

        showLoading("Salvando...");
        await saveBook(bookData);
        hideModal();
    };

    container.querySelector('#form-cancel-btn').onclick = hideModal;
    container.querySelector('#metadata-search-btn').onclick = () => handleMetadataSearch(container);
}


async function renderDetailsInModal(bookId) {
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    let book = allBooks.find(b => b.id === bookId);
    if (!book) { hideModal(); return; }

    const ratingHtml = book.rating ? Array.from({ length: 5 }, (_, i) => `<span class="material-symbols-outlined text-amber-400 !text-3xl ${i < book.rating ? 'filled' : ''}">star</span>`).join('') : '<span class="text-neutral-400">Sem avaliação</span>';
    const statusDisplay = { 'lido': 'Lido', 'lendo': 'Lendo Agora', 'quero-ler': 'Quero Ler', 'abandonado': 'Abandonado' }[book.status] || 'Sem status';
    let totalDisplay = '';
    const bookType = book.mediaType || 'fisico';
    if (bookType === 'fisico' || bookType === 'digital') { totalDisplay = `${book.totalPages || '?'} páginas`; }
    else if (bookType === 'audiobook') { totalDisplay = `${book.totalTime || '?'} de áudio`; }

    const feelingsHtml = book.feelings?.length > 0 ? `<div class="card-expressive p-6"><h3 class="text-xl font-bold mb-4">Como este livro me fez sentir</h3><div class="flex flex-wrap gap-2">${book.feelings.map(f => `<span class="mood-tag-pill text-sm font-bold px-3 py-1 rounded-full capitalize">${f}</span>`).join('')}</div></div>` : '';

    const bookShelves = book.shelves || [];
    const shelvesHtml = bookShelves.length > 0
        ? `<div class="card-expressive p-6">
               <h3 class="text-xl font-bold mb-4">Estantes</h3>
               <div class="flex flex-wrap gap-2">
                   ${bookShelves.map(shelfId => {
            const shelf = userShelves.find(s => s.id === shelfId);
            return shelf ? `<span class="bg-[hsla(var(--md-sys-color-primary),0.2)] text-[hsl(var(--md-sys-color-primary))] text-xs font-bold mr-2 px-2.5 py-1 rounded-full">${shelf.name}</span>` : '';
        }).join('')}
               </div>
           </div>`
        : '';

    const detailHTML = `
        <div class="card-expressive w-full max-w-5xl max-h-[90vh] flex flex-col relative">
            <button id="modal-close-btn" class="absolute top-4 right-5 text-neutral-400 hover:text-white text-4xl leading-none z-10">&times;</button>
            <div class="p-6 md:p-8 flex-grow overflow-y-auto">
                <div class="flex flex-col sm:flex-row gap-8 md:gap-12">
                    <div class="w-1/3 sm:w-1/5 mx-auto flex-shrink-0"><img src="${getCoverUrl(book)}" alt="Capa de ${book.title}" class="w-full rounded-2xl shadow-2xl"></div>
                    <div class="w-full sm:w-2/3 flex flex-col">
                        <h1 class="font-display text-3xl md:text-5xl lg:text-6xl mb-2">${book.title}</h1>
                        <h2 class="text-xl md:text-3xl text-neutral-300 mb-6">${book.author}</h2>
                        <div class="flex items-center gap-2 mb-6">${ratingHtml}</div>
                        <div class="flex flex-wrap gap-2 text-sm mb-6">
                            <span class="bg-neutral-800 text-neutral-300 font-bold py-1 px-3 rounded-full">${statusDisplay}</span>
                            <span class="bg-neutral-800 text-neutral-300 font-bold py-1 px-3 rounded-full">${totalDisplay}</span>
                        </div>
                         <div class="mt-auto flex flex-col sm:flex-row gap-4">
                            <a href="#/edit/${book.id}" class="btn-expressive btn-primary flex-1"><span class="material-symbols-outlined mr-2">edit</span>Editar</a>
                            <button id="quick-add-to-shelf-btn" class="btn-expressive btn-tonal"><span class="material-symbols-outlined mr-2">add_circle</span>Adic. à Estante</button>
                            <button id="share-book-btn" class="btn-expressive btn-tonal"><span class="material-symbols-outlined mr-2">share</span>Partilhar</button>
                            <button id="delete-book-btn" class="btn-expressive bg-red-900/60 text-red-300 hover:bg-red-800"><span class="material-symbols-outlined">delete</span></button>
                        </div>
                    </div>
                </div>
                
                <div class="mt-8 space-y-6">
                    ${book.status === 'lendo' ? renderProgressUpdater(book) : ''}
                     ${shelvesHtml}
                     ${book.synopsis ? `<div class="card-expressive p-6"><h3 class="text-xl font-bold mb-4">Sinopse</h3><p class="text-neutral-300 whitespace-pre-wrap">${book.synopsis}</p></div>` : ''}
                     ${book.review ? `<div class="card-expressive p-6"><h3 class="text-xl font-bold mb-4">A Minha Resenha</h3><p class="text-neutral-300 whitespace-pre-wrap">${book.review}</p></div>` : ''}
                     ${feelingsHtml}
                </div>
            </div>
        </div>
    `;

    modalContent.innerHTML = detailHTML;
    modalContainer.classList.remove('hidden');

    modalContent.querySelector('#modal-close-btn').onclick = hideModal;
    modalContainer.onclick = hideModal;
    modalContent.firstElementChild.onclick = (e) => e.stopPropagation();
    modalContent.querySelector('#delete-book-btn').onclick = () => showModal('Confirmar Exclusão', `Tem a certeza que deseja excluir o livro "<strong>${book.title}</strong>"?`, [{ id: 'confirm-delete-btn', text: 'Sim, Excluir', class: 'bg-red-600 text-white', onClick: () => deleteBook(book.id) }]);
    modalContent.querySelector('#quick-add-to-shelf-btn').onclick = () => showQuickShelfManager(book);
    // ADICIONADO: Event listener para o novo botão de partilha
    modalContent.querySelector('#share-book-btn').onclick = () => handleShareBook(book);


    if (book.status === 'lendo') {
        modalContent.querySelector('#update-progress-btn').onclick = () => {
            const progressValue = modalContent.querySelector('#progress-input').value;
            updateBookProgress(book.id, Number(progressValue));
        }
    }
    document.addEventListener('keydown', handleEscKey);
}

// ADICIONADO: Função para lidar com a partilha do livro
function handleShareBook(book) {
    const vercelApiUrl = 'https://bookshelf-lyart-six.vercel.app/api/gerar-imagem';

    const params = new URLSearchParams();
    params.append('title', book.title || 'Sem Título');
    params.append('author', book.author || 'Autor Desconhecido');
    if (book.coverUrl) {
        params.append('coverUrl', getCoverUrl(book, 400, 600));
    }
    if (userProfile.avatarUrl) {
        params.append('avatarUrl', userProfile.avatarUrl);
    }
    if (userProfile.name) {
        params.append('userName', userProfile.name);
    }

    const imageUrl = `${vercelApiUrl}?${params.toString()}`;
    window.open(imageUrl, '_blank');
}

function showQuickShelfManager(book) {
    const bookShelves = book.shelves || [];
    const content = `
        <div id="quick-shelf-selection" class="max-h-60 overflow-y-auto space-y-2 pr-2">
            ${userShelves.map(shelf => `
                <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-800/50 cursor-pointer">
                    <input type="checkbox" name="quick-shelves" value="${shelf.id}" class="h-5 w-5 rounded" ${bookShelves.includes(shelf.id) ? 'checked' : ''}>
                    <span>${shelf.name}</span>
                </label>
            `).join('')}
        </div>
    `;
    const actions = [{
        id: 'save-quick-shelves', text: 'Salvar', class: 'btn-primary', onClick: async () => {
            const selectedShelves = Array.from(document.querySelectorAll('input[name="quick-shelves"]:checked')).map(cb => cb.value);
            showLoading("Salvando...");
            await saveBook({ id: book.id, shelves: selectedShelves });
            hideModal();
            renderDetailsInModal(book.id);
        }
    }];
    showModal('Adicionar/Remover de Estantes', content, actions);
}


function renderProgressUpdater(book) {
    let label, value, max, step, type, placeholder;
    const bookType = book.mediaType || 'fisico';
    type = 'number'; placeholder = ''; step = 1; max = '';
    if (bookType === 'fisico' || bookType === 'digital') { const total = book.totalPages || book.pages; label = `Página Atual (de ${total || '?'})`; value = book.currentProgress || 0; max = total || ''; }
    else if (bookType === 'audiobook') { label = `Tempo Ouvido (de ${book.totalTime || '??:??:??'})`; const s = book.currentProgress || 0; value = new Date(s * 1000).toISOString().slice(11, 19); type = 'text'; placeholder = 'HH:MM:SS'; }
    return `
         <div class="card-expressive p-6 mb-8">
            <h3 class="text-xl font-bold mb-4">Atualizar Leitura</h3>
            <div class="flex items-end gap-4">
                <div class="flex-grow">
                     <label for="progress-input" class="block text-sm font-bold mb-2 text-neutral-300">${label}</label>
                     <input type="${type}" id="progress-input" class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${value}" ${max ? `max="${max}"` : ''} ${step ? `step="${step}"` : ''} placeholder="${placeholder}">
                </div>
                <button id="update-progress-btn" class="btn-expressive btn-tonal">Atualizar</button>
            </div>
             <button id="mark-as-read-btn" class="btn-expressive btn-primary w-full mt-4 hidden">Marcar como Lido</button>
        </div>
    `;
}

// --- FUNÇÕES DA GOOGLE BOOKS API ---

async function handleMetadataSearch(container = document) {
    const title = container.querySelector('#title').value;
    if (!title) { showModal("Falta o Título", "Por favor, insira um título."); return; }
    showLoading('A procurar edições...');
    const query = encodeURIComponent(`intitle:${title}`);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&key=${GOOGLE_BOOKS_API_KEY}&maxResults=40`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            apiSearchResults = data.items;
            currentApiResultIndex = 0;
            showApiResultsModal();
        } else {
            hideModal();
            showModal("Nenhum Resultado", "Nenhum livro foi encontrado com este título.");
        }
    } catch (error) {
        hideModal();
        showModal("Erro na Busca", `Não foi possível buscar os dados: ${error.message}`);
    }
}

function showApiResultsModal() {
    const book = apiSearchResults[currentApiResultIndex];
    if (!book) return;
    const volumeInfo = book.volumeInfo;
    const coverUrl = volumeInfo.imageLinks?.thumbnail?.replace('http://', 'https://') || `https://placehold.co/128x194/1a1a1a/ffffff?text=Sem+Capa`;

    const content = `
        <div class="flex flex-col md:flex-row gap-4 h-[220px]">
            <img src="${coverUrl}" alt="Capa de ${volumeInfo.title || ''}" class="w-[128px] h-[194px] object-cover rounded-lg shadow-md flex-shrink-0" style="width: 128px; height: 194px;">
            <div class="flex-grow flex flex-col min-w-0">
                <h3 class="font-bold text-lg truncate">${volumeInfo.title || 'Título Desconhecido'}</h3>
                <p class="text-sm text-neutral-400 truncate">${volumeInfo.authors?.join(', ') || 'Autor Desconhecido'}</p>
                <p class="text-xs text-neutral-500 mt-1">${volumeInfo.pageCount || '?'} páginas</p>
                <div class="text-sm mt-2 overflow-y-auto h-full pr-2">
                    <p>${volumeInfo.description || 'Sinopse não disponível.'}</p>
                </div>
            </div>
        </div>
        <div class="flex justify-between items-center mt-4">
             <button id="prev-book-btn" class="btn-expressive btn-text !h-10 !p-2">&lt; Ant</button>
             <span>${currentApiResultIndex + 1} de ${apiSearchResults.length}</span>
             <button id="next-book-btn" class="btn-expressive btn-text !h-10 !p-2">Próx &gt;</button>
        </div>
    `;
    const actions = [{ id: 'select-book-btn', text: 'É esta!', class: 'btn-primary', onClick: selectApiBook, keepOpen: true }];

    showModal(`Resultados da Busca`, content, actions);
    document.getElementById('prev-book-btn').disabled = currentApiResultIndex === 0;
    document.getElementById('next-book-btn').disabled = currentApiResultIndex === apiSearchResults.length - 1;
    document.getElementById('prev-book-btn').onclick = showPrevApiBook;
    document.getElementById('next-book-btn').onclick = showNextApiBook;
}

function showNextApiBook() { if (currentApiResultIndex < apiSearchResults.length - 1) { currentApiResultIndex++; showApiResultsModal(); } }
function showPrevApiBook() { if (currentApiResultIndex > 0) { currentApiResultIndex--; showApiResultsModal(); } }

function selectApiBook() {
    const bookResult = apiSearchResults[currentApiResultIndex].volumeInfo;

    const bookData = {
        title: bookResult.title || '',
        author: bookResult.authors?.join(', ') || '',
        synopsis: bookResult.description || '',
        totalPages: bookResult.pageCount || '',
        isbn: bookResult.industryIdentifiers?.find(i => i.type === "ISBN_13")?.identifier || bookResult.industryIdentifiers?.find(i => i.type === "ISBN_10")?.identifier || '',
        coverUrl: bookResult.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
        categories: bookResult.categories || [],
        id: null,
        status: 'quero-ler',
        rating: 0,
        favorite: false,
        feelings: [],
        shelves: [],
    };

    renderFormInModal(null, bookData);
}


function handleCsvExport() {
    if (allBooks.length === 0) { showModal("Sem dados", "Não há livros para exportar."); return; }
    const csv = Papa.unparse(allBooks.map(b => ({ 'Book Id': b.id, 'Title': b.title, 'Author': b.author, 'ISBN': b.isbn || '', 'My Rating': b.rating || 0, 'Date Read': b.endDate || '', 'Date Added': b.addedAt?.toISOString().split('T')[0] || '', 'Bookshelves': (b.shelves || []).map(id => userShelves.find(s => s.id === id)?.name).join(', '), 'My Review': b.review || '' })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "a_minha_estante.csv";
    link.click();
}

function handleCsvImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    showLoading("Importando CSV...");
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const booksToImport = results.data.map(row => {
                const shelves = row['Exclusive Shelf'] || '';
                let status = 'quero-ler';
                if (shelves === 'read') status = 'lido';
                if (shelves === 'currently-reading') status = 'lendo';
                return { title: row.Title || '', author: row.Author || '', status: status };
            }).filter(b => b.title && b.author);

            if (booksToImport.length > 0) {
                const response = await fetch('/bookshelf/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ books: booksToImport })
                });
                const result = await response.json();
                if (result.status === 'success') {
                    await loadData();
                    hideModal();
                    showModal("Importação Concluída", `${booksToImport.length} livros foram importados!`);
                }
            } else {
                hideModal();
                showModal("Nenhum livro válido", "Não foram encontrados livros válidos para importar.");
            }
        },
        error: (err) => { hideModal(); showModal("Erro no CSV", `Não foi possível processar o ficheiro: ${err.message}`); }
    });
}


// --- INICIALIZAÇÃO DO APP ---
window.addEventListener('load', () => {
    initApp();
});
