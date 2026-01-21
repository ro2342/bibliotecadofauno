// --- CONFIGURAÇÃO E VARIÁVEIS GLOBAIS ---
const GOOGLE_BOOKS_API_KEY = ""; // Mantenha vazio ou use uma chave pública se necessário (para busca de metadados)

// Estado Global da Aplicação
let allBooks = [];
let userShelves = [];
let userProfile = { theme: 'dark', avatarUrl: null, name: '' };
let shelfSearchTerm = "";
let currentFilter = 'todos';
let currentPage = 1;
let itemsPerPage = 20; // Default
let apiSearchResults = [];
let currentApiResultIndex = 0;
let shelfPaginationState = {}; // { shelfId: pageNumber }

// --- ELEMENTOS DOM (Cache básico) ---
const app = document.getElementById('app');
const modalContainer = document.getElementById('modal-container');
const modalContent = document.getElementById('modal-content');

// --- INICIALIZAÇÃO ---
window.addEventListener('load', () => {
    initApp();
});

async function initApp() {
    showLoading("A carregar a sua biblioteca...");
    try {
        await loadData();
        applyTheme(userProfile.theme || 'dark');
        router();
        window.addEventListener('hashchange', router);
        setupGlobalListeners();
        hideLoading();
    } catch (error) {
        console.error("Erro ao inicializar:", error);
        showModal("Erro", "Não foi possível carregar a aplicação. Tente recarregar a página.");
        hideLoading();
    }
}

// --- CAMADA DE DADOS (API) ---

async function loadData() {
    try {
        const response = await fetch('/bookshelf/api/data');
        if (!response.ok) throw new Error('Falha ao carregar dados');
        const data = await response.json();

        if (data.status === 'success') {
            allBooks = data.books.map(book => {
                // Merge book data with progress data
                const progress = data.progress[book.id] || {};
                const extraData = progress.data || {}; 
                return {
                    ...book,
                    ...extraData,
                    status: mapStatus(progress.percent, progress.location, extraData.status),
                    currentProgress: progress.percent,
                    // If backend returned mapped status use it, otherwise derive
                };
            });
            
            userShelves = data.shelves;
            userProfile = { 
                ...userProfile, 
                theme: data.user.theme, 
                avatarUrl: data.user.avatar,
                name: data.user.name
            };
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error("Erro no loadData:", error);
    }
}

// Helper to map status
function mapStatus(percent, location, savedStatus) {
    if (savedStatus) return savedStatus;
    if (percent >= 1.0) return 'lido';
    if (percent > 0) return 'lendo';
    return 'quero-ler'; 
}


async function saveBook(bookData) {
    try {
        const response = await fetch('/bookshelf/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });
        const result = await response.json();
        if (result.status === 'success') {
            await loadData(); 
            router();
            return result.id;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Erro ao salvar livro:", error);
        showModal("Erro", "Não foi possível salvar o livro.");
    }
}

async function deleteBook(bookId) {
    try {
        const response = await fetch('/bookshelf/api/book/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: bookId })
        });
        const result = await response.json();
        if (result.status === 'success') {
            allBooks = allBooks.filter(b => b.id !== bookId);
            router();
            hideModal(); // Close confirmation modal
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Erro ao excluir livro:", error);
        showModal("Erro", "Não foi possível excluir o livro.");
    }
}

async function saveShelf(shelfData) {
    try {
        const response = await fetch('/bookshelf/api/shelf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', ...shelfData })
        });
        const result = await response.json();
        if (result.status === 'success') {
            await loadData();
            return result.id;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Erro ao criar estante:", error);
        showModal("Erro", "Não foi possível criar a estante.");
    }
}

async function deleteShelf(shelfId) {
    try {
        const response = await fetch('/bookshelf/api/shelf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: shelfId })
        });
        const result = await response.json();
        if (result.status === 'success') {
            userShelves = userShelves.filter(s => s.id !== shelfId);
            router(); 
            hideModal();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Erro ao excluir estante:", error);
        showModal("Erro", "Não foi possível excluir a estante.");
    }
}

async function saveProfile(profileData) {
    try {
        const response = await fetch('/bookshelf/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...profileData }) 
        });
        const result = await response.json();
        if (result.status === 'success') {
             userProfile = { ...userProfile, ...profileData };
             showModal("Sucesso", "Perfil atualizado!");
        } else {
            throw new Error(result.message);
        }
    } catch(e) {
        console.error(e);
        showModal("Erro", "Falha ao salvar perfil.");
    }
}

async function applyTheme(theme) {
    userProfile.theme = theme;
    document.documentElement.className = theme;
}

// --- ROTEAMENTO E UI ---

function router() {
    const hash = window.location.hash || '#/estantes';
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    
    // Desktop Nav Active State
    document.querySelectorAll('#desktop-nav a').forEach(link => {
        link.classList.remove('bg-neutral-700/50', 'text-white');
        link.classList.add('text-neutral-400');
        if (link.getAttribute('href') === hash) {
            link.classList.add('bg-neutral-700/50', 'text-white');
            link.classList.remove('text-neutral-400');
        }
    });

    if (hash === '#/estantes') {
        document.getElementById('page-estantes').classList.remove('hidden');
        renderEstantes();
    } else if (hash === '#/meus-livros') {
        document.getElementById('page-meus-livros').classList.remove('hidden');
        renderMeusLivros();
    } else if (hash === '#/estatisticas') {
        document.getElementById('page-estatisticas').classList.remove('hidden');
        renderEstatisticas();
    } else if (hash === '#/ferramentas') {
        document.getElementById('page-ferramentas').classList.remove('hidden');
        renderFerramentas(); // Ensure function exists or create stub
    } else if (hash === '#/profile') {
        document.getElementById('page-profile').classList.remove('hidden');
        renderProfile(); // Ensure function exists
    } else if (hash === '#/settings') {
        document.getElementById('page-settings').classList.remove('hidden');
        renderSettings(); // Ensure function exists
    } else if (hash === '#/add') {
        renderFormInModal(); // Add new book
    } else if (hash.startsWith('#/book/')) {
        const bookId = hash.split('/')[2]; 
        renderDetailsInModal(parseInt(bookId) || bookId);
    } else if (hash.startsWith('#/edit/')) {
        const bookId = hash.split('/')[2];
        renderFormInModal(parseInt(bookId) || bookId);
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO (Adaptadas) ---

function getCoverUrl(book) {
    if (book.coverUrl && !book.coverUrl.includes('placehold.co')) {
        return book.coverUrl;
    }
    if (book.cover) return book.cover; 
    
    return `https://placehold.co/128x194/1a1a1a/ffffff?text=${encodeURIComponent(book.title || 'Sem Capa')}`;
}

function getPageHeader(title) {
    return `<header class="mb-8 flex items-center justify-between">
                <h1 class="font-display text-4xl title-text-shadow font-bold">${title}</h1>
                <div class="flex items-center gap-4">
                     ${userProfile.avatarUrl ? `<img src="${userProfile.avatarUrl}" class="w-10 h-10 rounded-full border-2 border-[hsl(var(--md-sys-color-primary))]">` : '<span class="material-symbols-outlined text-3xl">account_circle</span>'}
                </div>
            </header>`;
}

function renderEstantes() {
    const page = document.getElementById('page-estantes');
    page.innerHTML = `
        <div class="max-w-6xl mx-auto space-y-8">
            ${getPageHeader('Minhas Estantes')}
            
            <!-- Quick Stats -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="card-expressive p-4 text-center">
                    <p class="text-sm text-neutral-400">Total Livros</p>
                    <p class="font-display text-3xl font-bold text-white">${allBooks.length}</p>
                </div>
                <div class="card-expressive p-4 text-center">
                    <p class="text-sm text-neutral-400">Lidos</p>
                    <p class="font-display text-3xl font-bold text-[hsl(var(--md-sys-color-primary))]">${allBooks.filter(b => b.status === 'lido').length}</p>
                </div>
                <div class="card-expressive p-4 text-center">
                    <p class="text-sm text-neutral-400">Lendo</p>
                    <p class="font-display text-3xl font-bold text-amber-400">${allBooks.filter(b => b.status === 'lendo').length}</p>
                </div>
                 <div class="card-expressive p-4 text-center">
                    <p class="text-sm text-neutral-400">Quero Ler</p>
                    <p class="font-display text-3xl font-bold text-neutral-300">${allBooks.filter(b => b.status === 'quero-ler').length}</p>
                </div>
            </div>

            <!-- New Shelf Input -->
             <div class="card-expressive p-6">
                <h3 class="text-lg font-bold mb-4">Nova Estante</h3>
                <div class="flex gap-2">
                    <input type="text" id="new-shelf-name" placeholder="Nome da estante..." class="flex-grow bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3 focus:border-[hsl(var(--md-sys-color-primary))] focus:ring-0 transition-colors">
                    <button id="add-shelf-btn" class="btn-expressive btn-primary whitespace-nowrap"><span class="material-symbols-outlined mr-2">add</span>Criar</button>
                </div>
            </div>

            <div id="shelves-container" class="space-y-8"></div>
        </div>`;

    const container = document.getElementById('shelves-container');
    const sortedShelves = [...userShelves].sort((a, b) => a.name.localeCompare(b.name));
    container.innerHTML = sortedShelves.map(shelf => getShelfHtml(shelf)).join('');
    
    document.getElementById('add-shelf-btn').onclick = async () => {
        const name = document.getElementById('new-shelf-name').value;
        if (name) {
            await saveShelf({ name });
            document.getElementById('new-shelf-name').value = '';
        }
    };
    
    attachShelfEventListeners();
}

function getShelfHtml(shelf) {
    const booksOnShelf = allBooks.filter(b => b.shelves && b.shelves.includes(shelf.id));
    const previewBooks = booksOnShelf.slice(0, 7); 
    
    return `
    <div class="card-expressive p-6 shelf-container" data-shelf-id="${shelf.id}">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-[hsl(var(--md-sys-color-primary))]">shelves</span> ${shelf.name} 
                <span class="text-sm text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">${booksOnShelf.length}</span>
            </h2>
            <div class="flex gap-2">
                <button class="delete-shelf-btn text-neutral-500 hover:text-red-500" data-shelf-id="${shelf.id}"><span class="material-symbols-outlined">delete</span></button>
            </div>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-4">
            ${previewBooks.length > 0 ? previewBooks.map(b => `
                <a href="#/book/${b.id}" class="flex-shrink-0 w-24">
                    <img src="${getCoverUrl(b)}" class="w-full h-36 object-cover rounded shadow-md hover:scale-105 transition-transform">
                </a>
            `).join('') : '<p class="text-neutral-500 italic text-sm">Estante vazia</p>'}
        </div>
    </div>`;
}

function attachShelfEventListeners() {
    document.querySelectorAll('.delete-shelf-btn').forEach(btn => {
        btn.onclick = () => {
            if(confirm("Tem a certeza que deseja apagar esta estante?")) deleteShelf(btn.dataset.shelfId);
        };
    });
}

function renderMeusLivros() {
    const page = document.getElementById('page-meus-livros');
    page.innerHTML = `
        <div class="max-w-6xl mx-auto space-y-6">
            ${getPageHeader('Meus Livros')}
             <div class="flex gap-4 mb-6">
                <input type="search" id="book-search" placeholder="Pesquisar..." class="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3" value="${shelfSearchTerm}">
                <select id="status-filter" class="bg-neutral-800 border-2 border-neutral-700 rounded-xl p-3">
                    <option value="todos">Todos</option>
                    <option value="lendo">Lendo</option>
                    <option value="quero-ler">Quero Ler</option>
                    <option value="lido">Lido</option>
                </select>
            </div>
            <div id="books-grid" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6"></div>
        </div>
    `;
    
    updateBooksGrid();
    
    document.getElementById('book-search').oninput = (e) => {
        shelfSearchTerm = e.target.value;
        updateBooksGrid();
    };
    
    document.getElementById('status-filter').onchange = (e) => {
        currentFilter = e.target.value;
        updateBooksGrid();
    }
}

function updateBooksGrid() {
    const container = document.getElementById('books-grid');
    if (!container) return;
    
    let filtered = allBooks;
    if (shelfSearchTerm) {
        filtered = filtered.filter(b => b.title.toLowerCase().includes(shelfSearchTerm.toLowerCase()));
    }
    if (currentFilter !== 'todos') {
        filtered = filtered.filter(b => b.status === currentFilter);
    }
    
    container.innerHTML = filtered.map(b => `
        <a href="#/book/${b.id}" class="group relative block aspect-[2/3] bg-neutral-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <img src="${getCoverUrl(b)}" class="w-full h-full object-cover group-hover:opacity-75 transition-opacity">
            <div class="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent">
                <p class="text-white text-sm font-bold truncate">${b.title}</p>
                <p class="text-neutral-400 text-xs truncate">${b.author}</p>
                ${b.status === 'lendo' ? `<div class="w-full bg-neutral-700 h-1 mt-1 rounded-full"><div class="bg-amber-400 h-1 rounded-full" style="width: ${b.currentProgress*100 || 0}%"></div></div>` : ''}
            </div>
        </a>
    `).join('');
}

// Stubs for missing render functions to prevent errors
function renderEstatisticas() {
    const page = document.getElementById('page-estatisticas');
    page.innerHTML = getPageHeader('Estatísticas') + '<p>Em construção...</p>';
}
function renderFerramentas() {
    const page = document.getElementById('page-ferramentas');
    page.innerHTML = getPageHeader('Ferramentas') + '<p>Em construção...</p>';
}
function renderProfile() {
    const page = document.getElementById('page-profile');
    page.innerHTML = getPageHeader('Perfil') + '<p>Em construção...</p>';
}
function renderSettings() {
    const page = document.getElementById('page-settings');
    page.innerHTML = getPageHeader('Configurações') + '<p>Em construção...</p>';
}
function renderFormInModal(id) {
    showModal('Editar', 'Funcionalidade de edição em breve.');
}
function renderDetailsInModal(id) {
    showModal('Detalhes', 'Detalhes do livro em breve.');
}

// --- UTILS ---
function showLoading(msg) {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.remove('hidden');
        const p = loader.querySelector('p');
        if (p) p.textContent = msg;
    }
}
function hideLoading() {
    const loader = document.getElementById('page-loader');
    if (loader) loader.classList.add('hidden');
}
function showModal(title, content) {
    modalContent.innerHTML = `<div class="card-expressive p-6 max-w-lg w-full"><h2 class="text-xl font-bold mb-4">${title}</h2><div class="mb-6">${content}</div><div class="flex justify-end"><button onclick="document.getElementById('modal-container').classList.add('hidden')" class="btn-expressive btn-primary">Fechar</button></div></div>`;
    modalContainer.classList.remove('hidden');
}
function hideModal() {
    modalContainer.classList.add('hidden');
}

function setupGlobalListeners() {
    document.getElementById('modal-container').onclick = (e) => {
         if (e.target === modalContainer) hideModal();
    }
}
