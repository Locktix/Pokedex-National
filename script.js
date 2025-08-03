// Configuration
const TOTAL_POKEMON = 1025;
let POKEMON_PER_PAGE = 16; // 4x4 grille
let TOTAL_PAGES = Math.ceil(TOTAL_POKEMON / POKEMON_PER_PAGE);

// Variables globales
let currentPage = 1;
let capturedPokemon = new Set();
let pokemonList = [];
let pokemonNamesData = []; // Stockage des noms français et anglais
let currentFilter = 'all'; // 'all', 'captured', 'missing'
let currentUser = null;
let randomUncapturedOnly = false; // Nouveau paramètre pour le random Pokémon

// Variables pour le système de rôles
let userRole = 'member'; // 'member', 'tester', 'admin'
let allUsers = [];

// Variables pour la gestion des avatars d'autres utilisateurs
let isChangingOtherUserAvatar = false;
let targetUserId = null;
let targetUsername = null;

// Ajout : mémoriser la page courante pour chaque filtre
let pageByFilter = { all: 1, captured: 1 };

// Éléments DOM
const pokemonGrid = document.getElementById('pokemon-grid');
const currentPageElement = document.getElementById('current-page');
const capturedCountElement = document.getElementById('captured-count');
const percentageElement = document.getElementById('percentage');
const remainingElement = document.getElementById('remaining');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const searchResults = document.getElementById('search-results');

const showAllBtn = document.getElementById('show-all');
const showCapturedBtn = document.getElementById('show-captured');
const showMissingBtn = document.getElementById('show-missing');

// Variables pour la recherche
let searchTimeout = null;
let selectedResultIndex = -1;
let currentSearchResults = [];

// ===== GESTION UTILISATEURS RELOOKÉE =====
let allUsersList = [];
let filteredUsersList = [];

// Ajout : gestion du sélecteur de taille de grille
const gridSizeBtn = document.getElementById('grid-size-btn');
const pokemonGridElem = document.getElementById('pokemon-grid');

// Fonction pour charger et afficher la version dynamiquement
async function loadAndDisplayVersion() {
    try {
        const response = await fetch('version.json');
        if (!response.ok) {
            throw new Error('Impossible de charger le fichier version.json');
        }
        const versionData = await response.json();
        const footerText = document.querySelector('.footer-text');
        if (footerText) {
            footerText.textContent = `Pokédex National © 2025 – par Locktix v${versionData.version}`;
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la version:', error);
        // En cas d'erreur, on garde la version par défaut
        const footerText = document.querySelector('.footer-text');
        if (footerText) {
            footerText.textContent = 'Pokédex National © 2025 – par Locktix v1.2.7';
        }
    }
}

// Configuration des tailles de grille
const gridSizes = [
    { size: 16, cols: 4, label: '4 x 4' },
    { size: 9, cols: 3, label: '3 x 3' },
    { size: 4, cols: 2, label: '2 x 2' }
];
let currentGridSizeIndex = 0;

function updateGridColumns(size) {
    if (!pokemonGridElem) return;
    const gridConfig = gridSizes.find(config => config.size === size);
    if (gridConfig) {
        pokemonGridElem.style.gridTemplateColumns = `repeat(${gridConfig.cols}, 1fr)`;
        // Mettre à jour le texte du bouton
        const gridSizeText = document.querySelector('.grid-size-text');
        if (gridSizeText) {
            gridSizeText.textContent = `Taille : ${gridConfig.label}`;
        }
    }
}

async function cycleGridSize() {
    currentGridSizeIndex = (currentGridSizeIndex + 1) % gridSizes.length;
    const newConfig = gridSizes[currentGridSizeIndex];
    
    POKEMON_PER_PAGE = newConfig.size;
    TOTAL_PAGES = Math.ceil(TOTAL_POKEMON / POKEMON_PER_PAGE);
    currentPage = 1;
    localStorage.setItem('gridSize', newConfig.size);
    updateGridColumns(newConfig.size);
    await displayCurrentPage();
    updateStats();
    
    // Mettre à jour le texte de pagination
    const pageInfo = document.querySelector('.page-info');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} / ${TOTAL_PAGES}`;
    }
}

if (gridSizeBtn) {
    // Charger la préférence depuis le localStorage
    const savedGridSize = localStorage.getItem('gridSize');
    let initialSize = 16;
    if (savedGridSize && (savedGridSize === '16' || savedGridSize === '9' || savedGridSize === '4')) {
        initialSize = parseInt(savedGridSize, 10);
        // Trouver l'index correspondant
        currentGridSizeIndex = gridSizes.findIndex(config => config.size === initialSize);
        if (currentGridSizeIndex === -1) currentGridSizeIndex = 0;
        POKEMON_PER_PAGE = initialSize;
        TOTAL_PAGES = Math.ceil(TOTAL_POKEMON / POKEMON_PER_PAGE);
    }
    updateGridColumns(initialSize);
    
    // Ajouter l'événement de clic
    gridSizeBtn.addEventListener('click', cycleGridSize);
}

// Fonction pour récupérer tous les noms de Pokémon en français et anglais depuis PokéAPI
async function fetchPokemonNames() {
    console.log('[PokéAPI] Début du chargement de la liste des espèces...');
    const speciesListResp = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1025');
    const speciesList = await speciesListResp.json();
    const urls = speciesList.results.map(s => s.url);
    console.log(`[PokéAPI] ${urls.length} URLs d'espèces à traiter.`);

    // Pour aller plus vite, on limite à 50 requêtes en parallèle
    const chunkSize = 50;
    let pokemonNames = [];
    for (let i = 0; i < urls.length; i += chunkSize) {
        const chunk = urls.slice(i, i + chunkSize);
        console.log(`[PokéAPI] Traitement du chunk ${i/chunkSize+1} (${i+1} à ${i+chunk.length})...`);
        const chunkResults = await Promise.all(chunk.map(async (url, idx) => {
            try {
                const resp = await fetch(url);
                const data = await resp.json();
                
                // Récupérer les noms français et anglais
                const frName = data.names.find(n => n.language.name === 'fr');
                const enName = data.names.find(n => n.language.name === 'en');
                
                if (frName) {
                    console.log(`[PokéAPI] #${data.id} : ${frName.name} (${enName ? enName.name : data.name})`);
                } else {
                    console.warn(`[PokéAPI] #${data.id} : nom FR non trouvé, fallback sur ${data.name}`);
                }
                
                return {
                    number: data.id,
                    french: frName ? frName.name : data.name,
                    english: enName ? enName.name : data.name
                };
            } catch (e) {
                console.error(`[PokéAPI] Erreur sur ${url} :`, e);
                return null;
            }
        }));
        pokemonNames = pokemonNames.concat(chunkResults.filter(Boolean));
        console.log(`[PokéAPI] ${pokemonNames.length} noms collectés jusqu'ici.`);
    }
    console.log(`[PokéAPI] Chargement terminé. Total : ${pokemonNames.length} noms.`);
    return pokemonNames;
}

// Initialisation
async function init() {
    try {
        // Charger et afficher la version dynamiquement
        await loadAndDisplayVersion();
        
        let pokemonListCache = localStorage.getItem('pokemonListCache');
        if (pokemonListCache) {
            const cachedData = JSON.parse(pokemonListCache);
            pokemonList = cachedData.map(p => p.french); // Garder la compatibilité
            pokemonNamesData = cachedData; // Stocker les données complètes
            console.log('[PokéAPI] Liste des Pokémon chargée depuis le cache localStorage');
        } else {
            pokemonGrid.innerHTML = '<p style="text-align: center; color: #667eea;">Chargement de la liste des Pokémon...<br>Ce chargement peut prendre 10 à 30 secondes la première fois.</p>';
            console.log('[PokéAPI] Aucun cache trouvé, chargement depuis PokéAPI...');
            pokemonNamesData = await fetchPokemonNames();
            pokemonList = pokemonNamesData.map(p => p.french); // Garder la compatibilité
            localStorage.setItem('pokemonListCache', JSON.stringify(pokemonNamesData));
            console.log('[PokéAPI] Liste des Pokémon chargée depuis PokéAPI et mise en cache');
        }
        // Initialiser l'authentification Firebase
        initAuth();
        console.log(`[PokéAPI] Application initialisée avec ${pokemonList.length} Pokémon (noms FR/EN dynamiques)`);
    } catch (error) {
        console.error('Erreur lors du chargement des Pokémon:', error);
        pokemonGrid.innerHTML = '<p style="text-align: center; color: red;">Erreur lors du chargement des données</p>';
        hideLoading();
        showAuth();
    }
}

// Initialiser l'authentification Firebase
function initAuth() {
    console.log('Initialisation de l\'authentification Firebase...');
    
    // Vérifier que Firebase est disponible
    if (!window.auth) {
        console.error('Firebase Auth n\'est pas disponible');
        showNotification('Erreur: Firebase non initialisé', 'error');
        hideLoading();
        showAuth();
        return;
    }
    
    // Écouter les changements d'état d'authentification
    window.auth.onAuthStateChanged(async (user) => {
        console.log('État d\'authentification changé:', user ? user.email : 'Déconnecté');
        
        if (user) {
            // Utilisateur connecté
            currentUser = user;
            console.log('Utilisateur connecté:', user.email);
            
            hideLoading();
            showApp();
            await loadUserData();
            await loadUserRole(); // Charger le rôle de l'utilisateur
            
            setupEventListeners();
            setupSettingsModal(); // Configurer le modal des paramètres
            loadRandomPokemonSetting(); // Charger les paramètres utilisateur
            await displayCurrentPage();
            updateStats();
            await setFilter(currentFilter);
        } else {
            // Utilisateur déconnecté
            currentUser = null;
            console.log('Utilisateur déconnecté');
            hideLoading();
            showAuth();
        }
    });
    
    // Configurer les event listeners d'authentification
    setupAuthEventListeners();
}

// Masquer l'écran de chargement
function hideLoading() {
    const loadingContainer = document.getElementById('loading-container');
    if (loadingContainer) {
        loadingContainer.style.display = 'none';
    }
}

// Afficher l'interface d'authentification
function showAuth() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

// Afficher l'application
function showApp() {
    console.log('Affichage de l\'application...');
    
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const userEmail = document.getElementById('user-email');
    
    if (authContainer && appContainer && userEmail) {
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        // Charger le pseudo depuis Firestore
        loadAndDisplayUsername();
        console.log('Interface de l\'application affichée');
    } else {
        console.error('Éléments DOM manquants:', {
            authContainer: !!authContainer,
            appContainer: !!appContainer,
            userEmail: !!userEmail
        });
    }
    
    // Nettoyer l'URL si nécessaire
    if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Nouvelle fonction pour charger et afficher le pseudo
async function loadAndDisplayUsername() {
    const userEmail = document.getElementById('user-email');
    if (!currentUser || !userEmail) return;
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            userEmail.textContent = userData.username || currentUser.email;
        } else {
            userEmail.textContent = currentUser.email;
        }
    } catch (e) {
        userEmail.textContent = currentUser.email;
    }
}

// Configurer les event listeners d'authentification
function setupAuthEventListeners() {
    // Boutons de basculement entre connexion et inscription
    document.getElementById('show-register').addEventListener('click', () => {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'flex';
    });
    
    document.getElementById('show-login').addEventListener('click', () => {
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'flex';
    });
    
    // Connexion
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    
    // Inscription
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    
    // Déconnexion
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

// Gérer la connexion
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    console.log('Tentative de connexion avec:', email);
    
    if (!email || !password) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    try {
        // Importer les fonctions Firebase dynamiquement
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
        console.log('Firebase auth importé, tentative de connexion...');
        
        const userCredential = await signInWithEmailAndPassword(window.auth, email, password);
        console.log('Connexion réussie:', userCredential.user.email);
        showNotification('Connexion réussie ! 🎉', 'success');
    } catch (error) {
        console.error('Erreur de connexion détaillée:', error);
        console.error('Code d\'erreur:', error.code);
        console.error('Message d\'erreur:', error.message);
        
        let errorMessage = 'Erreur de connexion';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Aucun compte trouvé avec cet email';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Mot de passe incorrect';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email invalide';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Trop de tentatives. Réessayez plus tard';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Gérer l'inscription
async function handleRegister() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    console.log('Tentative d\'inscription avec:', email, username);
    
    if (!username || !email || !password) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Le mot de passe doit contenir au moins 6 caractères', 'error');
        return;
    }
    
    try {
        // Importer les fonctions Firebase dynamiquement
        const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        
        console.log('Firebase imports réussis, création du compte...');
        
        const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
        console.log('Compte créé avec succès:', userCredential.user.uid);
        
        // Déterminer le rôle basé sur l'UID
        const userRole = userCredential.user.uid === 'g9jMDMi1Z5XDcWrWAx66Ap56Tp02' ? 'admin' : 'member';
        
        // Créer le profil utilisateur dans Firestore
        await setDoc(doc(window.db, 'users', userCredential.user.uid), {
            username: username,
            email: email,
            role: userRole, // Rôle déterminé automatiquement
            createdAt: new Date(),
            capturedPokemon: []
        });
        console.log('Profil utilisateur créé dans Firestore');
        
        showNotification('Compte créé avec succès ! 🎉', 'success');
    } catch (error) {
        console.error('Erreur d\'inscription détaillée:', error);
        console.error('Code d\'erreur:', error.code);
        console.error('Message d\'erreur:', error.message);
        
        let errorMessage = 'Erreur d\'inscription';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Un compte existe déjà avec cet email';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email invalide';
                break;
            case 'auth/weak-password':
                errorMessage = 'Le mot de passe est trop faible';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Gérer la déconnexion
async function handleLogout() {
    try {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
        await signOut(window.auth);
        showNotification('Déconnexion réussie', 'info');
    } catch (error) {
        console.error('Erreur de déconnexion:', error);
    }
}

// Configuration des event listeners
function setupEventListeners() {
    prevPageBtn.addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await displayCurrentPage();
            updateStats();
        }
    });
    
    nextPageBtn.addEventListener('click', async () => {
        if (currentPage < TOTAL_PAGES) {
            currentPage++;
            await displayCurrentPage();
            updateStats();
        }
    });

    // Aller à la première page
    const firstPageBtn = document.getElementById('first-page');
    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', async () => {
            currentPage = 1;
            await displayCurrentPage();
            updateStats();
        });
    }

    // Aller à une page précise
    const gotoInput = document.getElementById('goto-page-input');
    const gotoBtn = document.getElementById('goto-page-btn');
    if (gotoBtn && gotoInput) {
        gotoBtn.addEventListener('click', async () => {
            const page = parseInt(gotoInput.value, 10);
            if (!isNaN(page) && page >= 1 && page <= TOTAL_PAGES) {
                currentPage = page;
                await displayCurrentPage();
                updateStats();
            } else {
                showNotification('Numéro de page invalide', 'error');
            }
        });
        // Entrée clavier
        gotoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                gotoBtn.click();
            }
        });
    }

    // Event listeners pour la recherche
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleSearchKeydown);
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Fermer les résultats de recherche en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            hideSearchResults();
        }
    });
    
    // Focus sur la barre de recherche avec Ctrl+F
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
    });
    
    // Event listeners pour les filtres
    showAllBtn.addEventListener('click', () => setFilter('all'));
    showCapturedBtn.addEventListener('click', () => setFilter('captured'));
    // showMissingBtn supprimé
    
    // Event listener pour le Pokémon aléatoire
    const randomPokemonBtn = document.getElementById('random-pokemon-btn');
    if (randomPokemonBtn) {
        randomPokemonBtn.addEventListener('click', handleRandomPokemon);
    }
    
    // Event listener pour l'ajout rapide (maintenant dans les paramètres)
    const settingsQuickAddBtn = document.getElementById('settings-quick-add-btn');
    if (settingsQuickAddBtn) {
        settingsQuickAddBtn.addEventListener('click', handleQuickAdd);
    }
    
    // Event listener pour l'export de la liste des Pokémon
    const exportPokemonListBtn = document.getElementById('export-pokemon-list-btn');
    if (exportPokemonListBtn) {
        exportPokemonListBtn.addEventListener('click', handleExportPokemonList);
    }
    
    // Event listener pour copier la liste des Pokémon
    const copyPokemonListBtn = document.getElementById('copy-pokemon-list-btn');
    if (copyPokemonListBtn) {
        copyPokemonListBtn.addEventListener('click', handleCopyPokemonList);
    }
    
    // Event listener pour l'avatar
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar) {
        userAvatar.addEventListener('click', showAvatarModal);
    }
    
    // Setup du swipe pour mobile
    setupSwipeNavigation();
    
    // Event listeners pour les filtres de collection d'utilisateur
    const collectionFilterNumber = document.getElementById('collection-filter-number');
    const collectionFilterCapture = document.getElementById('collection-filter-capture');
    
    if (collectionFilterNumber) {
        collectionFilterNumber.addEventListener('click', () => changeCollectionFilter('number'));
    }
    
    if (collectionFilterCapture) {
        collectionFilterCapture.addEventListener('click', () => changeCollectionFilter('capture'));
    }
}

// ===== SWIPE NAVIGATION MOBILE =====

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isSwiping = false;

function setupSwipeNavigation() {
    const pokemonGrid = document.getElementById('pokemon-grid');
    if (!pokemonGrid) return;
    
    // Événements touch pour mobile
    pokemonGrid.addEventListener('touchstart', handleTouchStart, { passive: true });
    pokemonGrid.addEventListener('touchmove', handleTouchMove, { passive: false });
    pokemonGrid.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Événements mouse pour desktop (optionnel)
    pokemonGrid.addEventListener('mousedown', handleMouseStart);
    pokemonGrid.addEventListener('mousemove', handleMouseMove);
    pokemonGrid.addEventListener('mouseup', handleMouseEnd);
    pokemonGrid.addEventListener('mouseleave', handleMouseEnd);
}

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = false;
}

function handleTouchMove(e) {
    if (!touchStartX || !touchStartY) return;
    
    touchEndX = e.touches[0].clientX;
    touchEndY = e.touches[0].clientY;
    
    const deltaX = Math.abs(touchEndX - touchStartX);
    const deltaY = Math.abs(touchEndY - touchStartY);
    
    // Détecter si c'est un swipe horizontal
    if (deltaX > deltaY && deltaX > 50) {
        isSwiping = true;
        e.preventDefault(); // Empêcher le scroll vertical
    }
}

function handleTouchEnd(e) {
    if (!isSwiping) return;
    
    const deltaX = touchEndX - touchStartX;
    const minSwipeDistance = 100; // Distance minimale pour déclencher le swipe
    
    if (Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
            // Swipe vers la droite -> page précédente
            if (currentPage > 1) {
                currentPage--;
                displayCurrentPage();
                updateStats();
                showSwipeFeedback('prev');
            }
        } else {
            // Swipe vers la gauche -> page suivante
            if (currentPage < TOTAL_PAGES) {
                currentPage++;
                displayCurrentPage();
                updateStats();
                showSwipeFeedback('next');
            }
        }
    }
    
    // Reset
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
    isSwiping = false;
}

// Support mouse pour desktop (optionnel)
function handleMouseStart(e) {
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    isSwiping = false;
}

function handleMouseMove(e) {
    if (!touchStartX || !touchStartY) return;
    
    touchEndX = e.clientX;
    touchEndY = e.clientY;
    
    const deltaX = Math.abs(touchEndX - touchStartX);
    const deltaY = Math.abs(touchEndY - touchStartY);
    
    if (deltaX > deltaY && deltaX > 50) {
        isSwiping = true;
    }
}

function handleMouseEnd(e) {
    if (!isSwiping) return;
    
    const deltaX = touchEndX - touchStartX;
    const minSwipeDistance = 100;
    
    if (Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
            if (currentPage > 1) {
                currentPage--;
                displayCurrentPage();
                updateStats();
                showSwipeFeedback('prev');
            }
        } else {
            if (currentPage < TOTAL_PAGES) {
                currentPage++;
                displayCurrentPage();
                updateStats();
                showSwipeFeedback('next');
            }
        }
    }
    
    // Reset
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
    isSwiping = false;
}

// Feedback visuel pour le swipe
function showSwipeFeedback(direction) {
    const pokemonGrid = document.getElementById('pokemon-grid');
    if (!pokemonGrid) return;
    
    // Ajouter une classe temporaire pour l'animation
    pokemonGrid.classList.add(`swipe-${direction}`);
    
    // Retirer la classe après l'animation
    setTimeout(() => {
        pokemonGrid.classList.remove(`swipe-${direction}`);
    }, 300);
}

// Afficher la page courante avec animations
async function displayCurrentPage() {
    // Toujours mettre à jour le nombre de colonnes selon la taille de grille
    if (typeof updateGridColumns === 'function') {
        updateGridColumns(POKEMON_PER_PAGE);
    }
    
    let totalPages = TOTAL_PAGES;
    

    
    if (currentFilter === 'captured') {
        const capturedList = Array.from(capturedPokemon).sort((a, b) => a - b);
        totalPages = Math.max(1, Math.ceil(capturedList.length / POKEMON_PER_PAGE));
        if (currentPage > totalPages) currentPage = totalPages;
        currentPageElement.textContent = currentPage;
        pokemonGrid.innerHTML = '';
        const startIndex = (currentPage - 1) * POKEMON_PER_PAGE;
        const endIndex = Math.min(startIndex + POKEMON_PER_PAGE, capturedList.length);
        
        // Créer et ajouter les cartes
        for (let i = startIndex; i < endIndex; i++) {
            const pokemonNumber = capturedList[i];
            const pokemonName = pokemonList[pokemonNumber - 1];
            const card = createPokemonCard(pokemonNumber, pokemonName, true);
            pokemonGrid.appendChild(card);
        }
        
        updateNavigationButtons(totalPages === 1);
        // Mettre à jour le texte de pagination
        const pageInfo = document.querySelector('.page-info');
        if (pageInfo) {
            pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
        }
    } else {
        // Sinon, comportement normal (tous)
        totalPages = TOTAL_PAGES;
        if (currentPage > totalPages) currentPage = totalPages;
        currentPageElement.textContent = currentPage;
        const startIndex = (currentPage - 1) * POKEMON_PER_PAGE;
        const endIndex = Math.min(startIndex + POKEMON_PER_PAGE, TOTAL_POKEMON);
        pokemonGrid.innerHTML = '';
        
        // Créer et ajouter les cartes
        for (let i = startIndex; i < endIndex; i++) {
            const pokemonNumber = i + 1;
            const pokemonName = pokemonList[i];
            const isCaptured = capturedPokemon.has(pokemonNumber);
            const pokemonCard = createPokemonCard(pokemonNumber, pokemonName, isCaptured);
            pokemonGrid.appendChild(pokemonCard);
        }
        
        applyCurrentFilter();
        updateNavigationButtons(totalPages === 1);
        // Mettre à jour le texte de pagination
        const pageInfo = document.querySelector('.page-info');
        if (pageInfo) {
            pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
        }
    }
    
    // Re-trigger l'animation de transition de page
    pokemonGrid.style.animation = 'none';
    pokemonGrid.offsetHeight; // Force reflow
    pokemonGrid.style.animation = 'pageZoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';

}

// Créer une carte Pokémon
function createPokemonCard(number, name, isCaptured) {
    const card = document.createElement('div');
    card.className = `pokemon-card${isCaptured ? ' captured' : ' not-captured'}`;
    card.dataset.pokemonNumber = number;
    
    card.innerHTML = `
        <div class="pokemon-number">#${number.toString().padStart(3, '0')}</div>
        <div class="pokemon-name">${name}</div>
    `;
    
    // Ajouter l'event listener pour capturer/relâcher
    card.addEventListener('click', () => {
        togglePokemonCapture(number);
    });
    
    // Charger l'image de fond pour ce Pokémon
    loadPokemonImage(card, number);
    
    return card;
}

// Charger l'image d'un Pokémon depuis l'API
async function loadPokemonImage(card, pokemonNumber) {
    try {
        // URL de l'image officielle de Pokémon
        const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonNumber}.png`;
        
        // Créer un élément image pour précharger
        const img = new Image();
        
        img.onload = () => {
            // Une fois l'image chargée, l'ajouter comme fond
            card.style.backgroundImage = `url(${imageUrl})`;
            card.style.backgroundSize = 'cover';
            card.style.backgroundPosition = 'center';
            card.style.backgroundRepeat = 'no-repeat';
            
            // Ajouter un overlay semi-transparent pour améliorer la lisibilité du texte
            card.style.position = 'relative';
            
            // CRÉER TOUJOURS L'OVERLAY (même s'il existe déjà)
            let overlay = card.querySelector('.card-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'card-overlay';
                card.appendChild(overlay);
            }
            
            // Mettre à jour l'overlay avec la bonne couleur selon l'état de capture
            const isCaptured = capturedPokemon.has(pokemonNumber);
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: ${isCaptured 
                    ? 'linear-gradient(135deg, rgba(78, 205, 196, 0.3) 0%, rgba(68, 160, 141, 0.1) 50%, rgba(78, 205, 196, 0.4) 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.08) 100%)'
                };
                pointer-events: none;
                z-index: 1;
            `;
            
            // S'assurer que le texte reste au-dessus de l'overlay
            const numberElement = card.querySelector('.pokemon-number');
            const nameElement = card.querySelector('.pokemon-name');
            if (numberElement) numberElement.style.zIndex = '2';
            if (nameElement) nameElement.style.zIndex = '2';
        };
        
        img.onerror = () => {
            // En cas d'erreur, utiliser une image par défaut ou un motif
            console.warn(`Impossible de charger l'image pour le Pokémon #${pokemonNumber}`);
            card.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            
            // Créer quand même l'overlay même en cas d'erreur
            card.style.position = 'relative';
            let overlay = card.querySelector('.card-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'card-overlay';
                const isCaptured = capturedPokemon.has(pokemonNumber);
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: ${isCaptured 
                        ? 'linear-gradient(135deg, rgba(78, 205, 196, 0.3) 0%, rgba(68, 160, 141, 0.1) 50%, rgba(78, 205, 196, 0.4) 100%)'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.08) 100%)'
                    };
                    pointer-events: none;
                    z-index: 1;
                `;
                card.appendChild(overlay);
            }
        };
        
        // Démarrer le chargement
        img.src = imageUrl;
        
    } catch (error) {
        console.error(`Erreur lors du chargement de l'image pour le Pokémon #${pokemonNumber}:`, error);
        card.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
}

// Basculer la capture d'un Pokémon
async function togglePokemonCapture(pokemonNumber) {
    const wasCaptured = capturedPokemon.has(pokemonNumber);
    if (wasCaptured) {
        // Afficher une confirmation avant de retirer
        showRemovePokemonConfirm(pokemonNumber);
        return;
    } else {
        capturedPokemon.add(pokemonNumber);
        console.log(`[CAPTURE] Pokémon #${pokemonNumber} capturé`);
    }
    // Mettre à jour seulement la carte concernée
    updatePokemonCard(pokemonNumber);
    updateStats();
    // SAUVEGARDE IMMÉDIATE DANS FIREBASE
    try {
        await saveUserDataImmediate();
        console.log(`[CAPTURE] Données sauvegardées immédiatement pour Pokémon #${pokemonNumber}`);
    } catch (error) {
        console.error(`[CAPTURE] Erreur lors de la sauvegarde immédiate:`, error);
        // Fallback vers la sauvegarde normale
        saveUserData();
    }
}

// Overlay de confirmation pour retirer un Pokémon capturé
function showRemovePokemonConfirm(pokemonNumber) {
    // Vérifier si un overlay existe déjà
    let overlay = document.getElementById('remove-pokemon-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'remove-pokemon-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.45);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    overlay.innerHTML = `
        <div style="background: white; color: #333; border-radius: 18px; padding: 36px 32px; box-shadow: 0 8px 32px rgba(102,126,234,0.18); text-align: center; min-width: 320px; max-width: 90vw;">
            <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 18px;">Retirer ce Pokémon ?</div>
            <div style="margin-bottom: 22px;">Voulez-vous retirer ce Pokémon de votre collection ?</div>
            <div style="display: flex; gap: 18px; justify-content: center;">
                <button id="remove-pokemon-yes" style="background: linear-gradient(135deg, #ff6b6b, #ee5a52); color: white; border: none; border-radius: 8px; padding: 10px 24px; font-size: 1rem; font-weight: 600; cursor: pointer;">Oui</button>
                <button id="remove-pokemon-no" style="background: #eee; color: #333; border: none; border-radius: 8px; padding: 10px 24px; font-size: 1rem; font-weight: 600; cursor: pointer;">Non</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('remove-pokemon-yes').onclick = async function() {
        capturedPokemon.delete(pokemonNumber);
        updatePokemonCard(pokemonNumber);
        updateStats();
        try {
            await saveUserDataImmediate();
        } catch (error) {
            saveUserData();
        }
        overlay.remove();
    };
    document.getElementById('remove-pokemon-no').onclick = function() {
        overlay.remove();
    };
}

// Mettre à jour une carte Pokémon spécifique sans recharger les images
function updatePokemonCard(pokemonNumber) {
    const card = document.querySelector(`[data-pokemon-number="${pokemonNumber}"]`);
    if (card) {
        const isCaptured = capturedPokemon.has(pokemonNumber);
        card.classList.toggle('captured', isCaptured);
        card.classList.toggle('not-captured', !isCaptured);
        // Mettre à jour l'overlay si il existe
        const overlay = card.querySelector('.card-overlay');
        if (overlay) {
            if (isCaptured) {
                overlay.style.background = 'linear-gradient(135deg, rgba(78, 205, 196, 0.3) 0%, rgba(68, 160, 141, 0.1) 50%, rgba(78, 205, 196, 0.4) 100%)';
            } else {
                overlay.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.08) 100%)';
            }
        }
        
        // Appliquer le filtre actuel si nécessaire
        if (currentFilter !== 'all') {
            applyCurrentFilter();
        }
    }
}

// Mettre à jour les statistiques
function updateStats() {
    const capturedCount = capturedPokemon.size;
    const percentage = Math.round((capturedCount / TOTAL_POKEMON) * 100);
    const remaining = TOTAL_POKEMON - capturedCount;
    
    capturedCountElement.textContent = capturedCount;
    percentageElement.textContent = `${percentage}%`;
    remainingElement.textContent = remaining;
    
    // Mettre à jour la couleur du pourcentage selon la progression
    if (percentage >= 100) {
        percentageElement.style.color = '#4ecdc4';
    } else if (percentage >= 75) {
        percentageElement.style.color = '#44a08d';
    } else if (percentage >= 50) {
        percentageElement.style.color = '#667eea';
    } else {
        percentageElement.style.color = '#764ba2';
    }
}

// Mettre à jour l'état des boutons de navigation
function updateNavigationButtons(disable) {
    prevPageBtn.disabled = !!disable;
    nextPageBtn.disabled = !!disable;
    document.getElementById('first-page').disabled = !!disable;
    document.getElementById('goto-page-input').disabled = !!disable;
    document.getElementById('goto-page-btn').disabled = !!disable;
}

// Charger les données utilisateur depuis Firebase
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            capturedPokemon = new Set(userData.capturedPokemon || []);
            currentFilter = userData.currentFilter || 'all';
            console.log(`[PokéAPI] Données utilisateur chargées: ${capturedPokemon.size} Pokémon capturés`);
        } else {
            // Nouvel utilisateur, initialiser avec des données vides
            capturedPokemon = new Set();
            currentFilter = 'all';
        }
        
        // Charger l'avatar de l'utilisateur
        await loadUserAvatar();
    } catch (error) {
        console.error('Erreur lors du chargement des données utilisateur:', error);
        capturedPokemon = new Set();
        currentFilter = 'all';
    }
}

// Sauvegarder les données utilisateur dans Firebase (sauvegarde immédiate)
async function saveUserDataImmediate() {
    if (!currentUser) return;
    
    try {
        const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        await updateDoc(doc(window.db, 'users', currentUser.uid), {
            capturedPokemon: Array.from(capturedPokemon),
            currentFilter: currentFilter,
            lastSaved: new Date()
        });
        console.log('[SAUVEGARDE] Données sauvegardées immédiatement dans Firebase');
        return true;
    } catch (error) {
        console.error('[SAUVEGARDE] Erreur lors de la sauvegarde immédiate:', error);
        throw error; // Propager l'erreur pour le fallback
    }
}

// Sauvegarder les données utilisateur dans Firebase (sauvegarde normale)
async function saveUserData() {
    if (!currentUser) return;
    
    try {
        const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        await updateDoc(doc(window.db, 'users', currentUser.uid), {
            capturedPokemon: Array.from(capturedPokemon),
            currentFilter: currentFilter,
            lastSaved: new Date()
        });
        console.log('[PokéAPI] Données utilisateur sauvegardées dans Firebase');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde dans Firebase:', error);
        // Fallback vers localStorage en cas d'erreur
        saveToLocalStorage();
    }
}

// Fallback vers localStorage
function saveToLocalStorage() {
    const data = {
        capturedPokemon: Array.from(capturedPokemon),
        lastSaved: new Date().toISOString()
    };
    
    try {
        localStorage.setItem('pokemonChallenge', JSON.stringify(data));
        console.log('Données sauvegardées dans localStorage (fallback)');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde dans localStorage:', error);
    }
}

// Afficher une notification
function showNotification(message, type = 'info') {
    // Créer l'élément de notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Styles pour la notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#4ecdc4' : '#667eea'};
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    `;
    
    // Ajouter l'animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Supprimer la notification après 3 secondes
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Gestion des raccourcis clavier
document.addEventListener('keydown', (event) => {
    switch(event.key) {
        case 'ArrowLeft':
            if (currentPage > 1) {
                event.preventDefault();
                prevPageBtn.click();
            }
            break;
        case 'ArrowRight':
            if (currentPage < TOTAL_PAGES) {
                event.preventDefault();
                nextPageBtn.click();
            }
            break;
    }
});

// Démarrer l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM chargé, initialisation de l\'application...');
    init();
    // Attacher le listener sur le bouton "Gérer les utilisateurs" après que le DOM soit prêt
    const manageUsersBtn = document.getElementById('manage-users');
    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', showUsersManagement);
        console.log('[ADMIN] Listener attaché sur #manage-users');
    } else {
        console.warn('[ADMIN] Bouton #manage-users introuvable dans le DOM');
    }

    // Afficher la version du site dynamiquement depuis version.json
    fetch('version.json')
      .then(response => response.json())
      .then(data => {
        const footer = document.querySelector('.footer-minimal span');
        if (footer && data.version) {
          let versionText = ` · v${data.version}`;
          let tooltip = '';
          if (data.date || data.changelog) {
            tooltip = 'Version : ' + data.version;
            if (data.date) tooltip += '\nDate : ' + data.date;
            if (data.changelog) tooltip += '\n' + data.changelog;
          }
          const versionSpan = document.createElement('span');
          versionSpan.textContent = versionText;
          if (tooltip) versionSpan.title = tooltip;
          footer.appendChild(versionSpan);
        }
      });


});

// Empêcher le rechargement de la page lors de la soumission des formulaires
document.addEventListener('submit', (e) => {
    if (e.target.id === 'login-form' || e.target.id === 'register-form') {
        e.preventDefault();
    }
});

// Sauvegarder automatiquement toutes les 30 secondes
setInterval(saveUserData, 30000);

// Fonctions de filtrage
async function setFilter(filter) {
    // Sauvegarder la page courante pour le filtre précédent
    pageByFilter[currentFilter] = currentPage;
    currentFilter = filter;
    // Restaurer la page du filtre sélectionné, ou 1 si jamais visitée
    currentPage = pageByFilter[filter] || 1;
    showAllBtn.classList.toggle('active', filter === 'all');
    showCapturedBtn.classList.toggle('active', filter === 'captured');
    await displayCurrentPage();
    updateStats();
    saveUserData();
}

function applyCurrentFilter() {
    const cards = document.querySelectorAll('.pokemon-card');
    
    cards.forEach(card => {
        const pokemonNumber = parseInt(card.dataset.pokemonNumber);
        const isCaptured = capturedPokemon.has(pokemonNumber);
        
        // Retirer les classes précédentes
        card.classList.remove('hidden', 'fade-out');
        
        // Appliquer le filtre
        switch (currentFilter) {
            case 'captured':
                if (!isCaptured) {
                    card.classList.add('hidden');
                }
                break;
            case 'all':
            default:
                // Afficher tous les Pokémon
                break;
        }
    });
}

// Fonctions de recherche refaites
function handleSearchInput() {
    const query = searchInput.value.trim();
    const searchContainer = searchInput.closest('.search-container');
    
    // Animation de typing
    if (query.length > 0) {
        searchContainer.classList.add('typing');
        // Retirer la classe après l'animation
        setTimeout(() => {
            searchContainer.classList.remove('typing');
        }, 600);
    }
    
    // Afficher le bouton de suppression si il y a du texte
    if (query.length > 0) {
        clearSearchBtn.style.display = 'flex';
        setTimeout(() => {
            clearSearchBtn.classList.add('show');
        }, 10);
    } else {
        clearSearchBtn.classList.remove('show');
        setTimeout(() => {
            clearSearchBtn.style.display = 'none';
        }, 300);
    }
    
    // Recherche en temps réel avec délai
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    if (query.length === 0) {
        hideSearchResults();
        return;
    }
    
    searchTimeout = setTimeout(() => {
        performSearch(query);
    }, 300);
}

function handleSearchKeydown(e) {
    if (!searchResults.style.display || searchResults.style.display === 'none') {
        return;
    }
    
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            navigateResults(1);
            break;
        case 'ArrowUp':
            e.preventDefault();
            navigateResults(-1);
            break;
        case 'Enter':
            e.preventDefault();
            if (selectedResultIndex >= 0 && currentSearchResults[selectedResultIndex]) {
                selectSearchResult(currentSearchResults[selectedResultIndex].number);
            } else {
                handleSearch();
            }
            break;
        case 'Escape':
            e.preventDefault();
            clearSearch();
            break;
    }
}

function navigateResults(direction) {
    const resultItems = searchResults.querySelectorAll('.search-result-item');
    
    // Retirer la sélection précédente
    if (selectedResultIndex >= 0 && resultItems[selectedResultIndex]) {
        resultItems[selectedResultIndex].classList.remove('selected');
    }
    
    // Calculer le nouvel index
    selectedResultIndex += direction;
    
    if (selectedResultIndex < 0) {
        selectedResultIndex = resultItems.length - 1;
    } else if (selectedResultIndex >= resultItems.length) {
        selectedResultIndex = 0;
    }
    
    // Appliquer la nouvelle sélection
    if (resultItems[selectedResultIndex]) {
        resultItems[selectedResultIndex].classList.add('selected');
        resultItems[selectedResultIndex].scrollIntoView({ 
            block: 'nearest', 
            behavior: 'smooth' 
        });
    }
}

function performSearch(query) {
    const searchTerm = query.toLowerCase();
    
    // Rechercher dans la liste des Pokémon
    let results = pokemonNamesData
        .map((pokemon, index) => ({
            number: pokemon.number,
            name: pokemon.french,
            englishName: pokemon.english,
            isCaptured: capturedPokemon.has(pokemon.number)
        }))
        .filter(pokemon => 
            pokemon.name.toLowerCase().includes(searchTerm) ||
            pokemon.englishName.toLowerCase().includes(searchTerm) ||
            pokemon.number.toString().includes(searchTerm)
        );
    
    // Appliquer le filtre actif sur les résultats de recherche
    if (currentFilter === 'captured') {
        results = results.filter(pokemon => pokemon.isCaptured);
    }
    // Si le filtre est 'all', on affiche tous les résultats (capturés et non capturés)
    
    // Limiter à 8 résultats
    results = results.slice(0, 8);
    
    currentSearchResults = results;
    displaySearchResults(results);
}

function displaySearchResults(results) {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">Aucun Pokémon trouvé</div>';
        showSearchResults();
        return;
    }
    
    searchResults.innerHTML = results.map((pokemon, index) => `
        <div class="search-result-item" 
             onclick="selectSearchResult(${pokemon.number})" 
             data-index="${index}">
            <div class="search-result-image" data-pokemon="${pokemon.number}"></div>
            <div class="search-result-content">
                <div class="search-result-number">#${pokemon.number.toString().padStart(3, '0')}</div>
                <div class="search-result-name">${pokemon.name}</div>
                ${pokemon.isCaptured ? '<div class="search-result-captured">✓</div>' : ''}
            </div>
        </div>
    `).join('');
    
    // Charger les images pour les résultats
    results.forEach(pokemon => {
        loadSearchResultImage(pokemon.number);
    });
    
    showSearchResults();
    selectedResultIndex = -1; // Reset la sélection
}

function loadSearchResultImage(pokemonNumber) {
    const imageElement = searchResults.querySelector(`[data-pokemon="${pokemonNumber}"]`);
    if (!imageElement) return;
    
    const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonNumber}.png`;
    
    const img = new Image();
    img.onload = () => {
        imageElement.style.backgroundImage = `url(${imageUrl})`;
    };
    img.onerror = () => {
        console.warn(`Impossible de charger l'image pour le Pokémon #${pokemonNumber}`);
    };
    img.src = imageUrl;
}

function selectSearchResult(pokemonNumber) {
    console.log(`[SEARCH] Sélection du Pokémon #${pokemonNumber}`);
    
    // Fermer la recherche
    hideSearchResults();
    clearSearch();
    
    // Aller au Pokémon
    goToPokemon(pokemonNumber);
}

function showSearchResults() {
    searchResults.style.display = 'block';
    // Add a class to the toolbar to indicate it's expanded
    const toolbar = document.querySelector('.glass-toolbar');
    if (toolbar) {
        toolbar.classList.add('expanded');
    }
    
    // Trigger the show animation after a small delay
    setTimeout(() => {
        searchResults.classList.add('show');
    }, 10);
}

function hideSearchResults() {
    searchResults.classList.remove('show');
    selectedResultIndex = -1;
    // Remove the expanded class from the toolbar
    const toolbar = document.querySelector('.glass-toolbar');
    if (toolbar) {
        toolbar.classList.remove('expanded');
    }
    
    // Hide the element after the animation completes
    setTimeout(() => {
        searchResults.style.display = 'none';
    }, 400);
}

function clearSearch() {
    searchInput.value = '';
    hideSearchResults();
    clearSearchBtn.classList.remove('show');
    setTimeout(() => {
        clearSearchBtn.style.display = 'none';
    }, 300);
    searchInput.focus();
}

function handleSearch() {
    const query = searchInput.value.trim();
    if (query.length > 0) {
        performSearch(query);
    }
}

async function goToPokemon(pokemonNumber) {
    console.log(`[SEARCH] Navigation vers le Pokémon #${pokemonNumber}`);
    
    // Forcer le filtre sur "Tous" pour que la carte soit visible
    await setFilter('all');
    
    // Calculer la page contenant ce Pokémon
    const targetPage = Math.ceil(pokemonNumber / POKEMON_PER_PAGE);
    
    console.log(`[SEARCH] Pokémon #${pokemonNumber} se trouve à la page ${targetPage} (${POKEMON_PER_PAGE} Pokémon par page)`);
    
    // Aller à la page si nécessaire
    if (currentPage !== targetPage) {
        currentPage = targetPage;
        await displayCurrentPage();
        updateNavigationButtons();
    }
    
    // Mettre à jour les statistiques
    updateStats();
    
            // Attendre que la carte soit bien présente dans le DOM puis la mettre en surbrillance
        setTimeout(() => {
            const pokemonCard = document.querySelector(`[data-pokemon-number="${pokemonNumber}"]`);
            if (pokemonCard) {
                console.log(`[SEARCH] Carte trouvée, mise en surbrillance`);
                
                // Animation de surbrillance améliorée
                pokemonCard.classList.add('search-highlight');
                setTimeout(() => {
                    pokemonCard.classList.remove('search-highlight');
                }, 2000);
                
                // Scroll vers la carte
                pokemonCard.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            } else {
                console.log(`[SEARCH] ERREUR: Carte non trouvée`);
            }
        }, 300);
}

// ===== GESTION AVATAR =====

let currentAvatar = null; // numéro du Pokémon ou null
let selectedAvatar = null;
let avatarSearchResults = [];
let avatarSearchTimeout = null;

// Afficher le modal de sélection d'avatar
// Afficher le modal de sélection d'avatar pour l'utilisateur courant
function showAvatarModal() {
    showUserAvatarModal(null, null);
}

// Afficher le modal de sélection d'avatar pour un utilisateur spécifique (admin)
window.showUserAvatarModal = function(uid, username) {
    const modal = document.getElementById('avatar-modal');
    const avatarGrid = document.getElementById('avatar-grid');
    const saveBtn = document.getElementById('save-avatar');
    const cancelBtn = document.getElementById('cancel-avatar');
    const closeBtn = document.getElementById('close-avatar');
    const modalTitle = document.querySelector('#avatar-modal .modal-title .modal-text');
    
    if (!modal || !avatarGrid) return;
    
    // Définir si on change l'avatar d'un autre utilisateur
    isChangingOtherUserAvatar = uid !== null;
    targetUserId = uid;
    targetUsername = username;
    
    // Mettre à jour le titre du modal
    if (modalTitle) {
        if (isChangingOtherUserAvatar) {
            modalTitle.textContent = `Changer l'avatar de ${username}`;
        } else {
            modalTitle.textContent = 'Choisir un avatar';
        }
    }
    
    // Charger l'avatar actuel de l'utilisateur cible
    if (isChangingOtherUserAvatar) {
        loadTargetUserAvatar(uid);
    } else {
        selectedAvatar = currentAvatar;
    }
    
    // Créer la barre de recherche et la grille de résultats
    avatarGrid.innerHTML = `
        <div class="avatar-search-container">
            <input type="text" id="avatar-search-input" placeholder="Rechercher un Pokémon..." class="avatar-search-input">
        </div>
        <div id="avatar-results-grid" class="avatar-results-grid">
            <p class="avatar-search-hint">Tapez le nom d'un Pokémon pour commencer...</p>
        </div>
    `;
    
    // Event listeners pour la recherche
    const searchInput = document.getElementById('avatar-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleAvatarSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && avatarSearchResults.length > 0) {
                selectAvatar(avatarSearchResults[0].number);
            }
        });
    }
    
    // Afficher le modal
    modal.style.display = 'flex';
    
    // Event listeners pour les boutons
    if (saveBtn) {
        saveBtn.onclick = saveAvatar;
    }
    
    if (cancelBtn) {
        cancelBtn.onclick = closeAvatarModal;
    }
    
    if (closeBtn) {
        closeBtn.onclick = closeAvatarModal;
    }
    
    // Fermer en cliquant en dehors
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeAvatarModal();
        }
    };
    
    // Focus sur la barre de recherche
    setTimeout(() => {
        if (searchInput) searchInput.focus();
    }, 100);
}

// Gérer la recherche d'avatars
function handleAvatarSearch() {
    const query = document.getElementById('avatar-search-input').value.trim();
    
    if (avatarSearchTimeout) {
        clearTimeout(avatarSearchTimeout);
    }
    
    if (query.length === 0) {
        displayAvatarResults([]);
        return;
    }
    
    avatarSearchTimeout = setTimeout(() => {
        performAvatarSearch(query);
    }, 300);
}

// Effectuer la recherche d'avatars
function performAvatarSearch(query) {
    const searchTerm = query.toLowerCase();
    
    // Rechercher dans la liste des Pokémon
    const results = pokemonNamesData
        .map((pokemon, index) => ({
            number: pokemon.number,
            name: pokemon.french,
            englishName: pokemon.english
        }))
        .filter(pokemon => 
            pokemon.name.toLowerCase().includes(searchTerm) ||
            pokemon.englishName.toLowerCase().includes(searchTerm) ||
            pokemon.number.toString().includes(searchTerm)
        )
        .slice(0, 20); // Limiter à 20 résultats
    
    avatarSearchResults = results;
    displayAvatarResults(results);
}

// Afficher les résultats de recherche d'avatars
function displayAvatarResults(results) {
    const resultsGrid = document.getElementById('avatar-results-grid');
    
    if (results.length === 0) {
        resultsGrid.innerHTML = '<p class="avatar-no-results">Aucun Pokémon trouvé</p>';
        return;
    }
    
    resultsGrid.innerHTML = results.map(pokemon => `
        <div class="avatar-option ${pokemon.number === selectedAvatar ? 'selected' : ''}" 
             data-avatar="${pokemon.number}" 
             onclick="selectAvatar(${pokemon.number})">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.number}.png" 
                 alt="Avatar Pokémon #${pokemon.number}" 
                 style="width:64px;height:64px;object-fit:contain;" />
            <div class="avatar-pokemon-info">
                <div class="avatar-pokemon-number">#${pokemon.number.toString().padStart(3, '0')}</div>
                <div class="avatar-pokemon-name">${pokemon.name}</div>
            </div>
        </div>
    `).join('');
}

// Sélectionner un avatar
function selectAvatar(num) {
    selectedAvatar = num;
    
    // Mettre à jour la sélection visuelle
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('selected');
        if (parseInt(option.dataset.avatar) === num) {
            option.classList.add('selected');
        }
    });
    
    // Afficher un aperçu de la sélection
    const preview = document.getElementById('avatar-preview');
    if (preview) {
        preview.innerHTML = `
            <div class="avatar-preview-selected">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${num}.png" 
                     alt="Avatar sélectionné" 
                     style="width:48px;height:48px;object-fit:contain;" />
                <span>Pokémon #${num} sélectionné</span>
            </div>
        `;
    }
}

// Charger l'avatar actuel d'un utilisateur cible (admin)
async function loadTargetUserAvatar(uid) {
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'users', uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            selectedAvatar = userData.avatar || null;
        } else {
            selectedAvatar = null;
        }
    } catch (error) {
        console.error('Erreur lors du chargement de l\'avatar de l\'utilisateur:', error);
        selectedAvatar = null;
    }
}

// Sauvegarder l'avatar
async function saveAvatar() {
    let targetUid = currentUser.uid;
    let currentUserAvatar = currentAvatar;
    
    // Si on change l'avatar d'un autre utilisateur (admin)
    if (isChangingOtherUserAvatar && targetUserId) {
        targetUid = targetUserId;
        // Charger l'avatar actuel de l'utilisateur cible pour la comparaison
        try {
            const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
            const userDoc = await getDoc(doc(window.db, 'users', targetUid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                currentUserAvatar = userData.avatar || null;
            }
        } catch (error) {
            console.error('Erreur lors du chargement de l\'avatar actuel:', error);
        }
    }
    
    if (selectedAvatar === currentUserAvatar) {
        closeAvatarModal();
        return;
    }
    
    try {
        const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        await updateDoc(doc(window.db, 'users', targetUid), {
            avatar: selectedAvatar,
            lastSaved: new Date()
        });
        
        // Mettre à jour l'affichage local si c'est l'utilisateur courant
        if (!isChangingOtherUserAvatar) {
            currentAvatar = selectedAvatar;
            updateAvatarDisplay();
        } else {
            // Recharger la liste des utilisateurs pour mettre à jour l'affichage
            await showUsersManagement();
        }
        
        const successMessage = isChangingOtherUserAvatar 
            ? `Avatar de ${targetUsername} mis à jour ! 🎨` 
            : 'Avatar mis à jour ! 🎨';
        showNotification(successMessage, 'success');
    } catch (error) {
        const errorMessage = isChangingOtherUserAvatar 
            ? 'Erreur lors de la sauvegarde de l\'avatar de l\'utilisateur' 
            : 'Erreur lors de la sauvegarde de l\'avatar';
        showNotification(errorMessage, 'error');
    }
    
    closeAvatarModal();
}

// Fermer le modal d'avatar
function closeAvatarModal() {
    const modal = document.getElementById('avatar-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Réinitialiser les variables pour le changement d'avatar d'autres utilisateurs
    isChangingOtherUserAvatar = false;
    targetUserId = null;
    targetUsername = null;
}

// Mettre à jour l'affichage de l'avatar
function updateAvatarDisplay() {
    const avatarIcon = document.getElementById('avatar-icon');
    if (avatarIcon) {
        if (currentAvatar) {
            avatarIcon.innerHTML = `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${currentAvatar}.png" alt="Avatar" style="width:32px;height:32px;object-fit:contain;" />`;
        } else {
            avatarIcon.innerHTML = `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" alt="Pokéball" style="width:32px;height:32px;object-fit:contain;" />`;
        }
    }
}

// Charger l'avatar depuis Firebase
async function loadUserAvatar() {
    if (!currentUser) return;
    
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentAvatar = userData.avatar || null;
            updateAvatarDisplay();
        }
    } catch (error) {
        // fallback
        currentAvatar = null;
        updateAvatarDisplay();
    }
}

// ===== SYSTÈME DE RÔLES =====

// Charger le rôle de l'utilisateur
async function loadUserRole() {
    if (!currentUser) return;
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            userRole = userData.role || 'member';
            updateRoleDisplay();
        }
    } catch (error) {
        userRole = 'member';
    }
}

// Mettre à jour l'affichage du badge de rôle
function updateRoleDisplay() {
    const userRoleBadge = document.getElementById('user-role-badge');
    const settingsBtn = document.getElementById('settings-btn');
    
    if (userRoleBadge) {
        const roleNames = {
            'member': 'Membre',
            'tester': 'Testeur',
            'admin': 'Admin'
        };
        userRoleBadge.textContent = roleNames[userRole] || 'Membre';
        userRoleBadge.className = 'role-badge ' + userRole;
        userRoleBadge.style.display = 'inline-block';
    }
    
    // Afficher le bouton des paramètres pour tous les utilisateurs
    if (settingsBtn) {
        settingsBtn.style.display = 'flex';
    }
}

// Vérifier les permissions
function hasPermission(permission) {
    const permissions = {
        'member': ['view_pokemon', 'capture_pokemon'],
        'tester': ['view_pokemon', 'capture_pokemon', 'test_features'],
        'admin': ['view_pokemon', 'capture_pokemon', 'test_features', 'manage_users', 'manage_roles']
    };
    return permissions[userRole]?.includes(permission) || false;
}

// Gérer le modal des paramètres
function setupSettingsModal() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.style.display = 'flex';
            loadSettings();
            // Afficher la section admin si l'utilisateur est admin
            const adminSettings = document.getElementById('admin-settings');
            if (adminSettings && userRole === 'admin') {
                adminSettings.style.display = 'block';
            }
        });
    }
    
    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });
    }
    
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });
    }
    
    // Event listeners pour les fonctionnalités admin
    setupAdminEventListeners();
}

// Charger le paramètre random Pokémon
function loadRandomPokemonSetting() {
    const toggle = document.getElementById('random-uncaptured-toggle');
    if (toggle) {
        // Charger depuis le localStorage
        const saved = localStorage.getItem('randomUncapturedOnly');
        randomUncapturedOnly = saved === 'true';
        toggle.checked = randomUncapturedOnly;
    }
}

// Configurer les event listeners des paramètres
function setupSettingsEventListeners() {
    const toggle = document.getElementById('random-uncaptured-toggle');
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            randomUncapturedOnly = e.target.checked;
            localStorage.setItem('randomUncapturedOnly', randomUncapturedOnly.toString());
            showNotification(
                randomUncapturedOnly 
                    ? '🎲 Random Pokémon : uniquement non capturés' 
                    : '🎲 Random Pokémon : tous les Pokémon',
                'info'
            );
        });
    }
}

function loadSettings() {
    // Charger les paramètres utilisateur
    loadRandomPokemonSetting();
    setupSettingsEventListeners();
}

// ===== FONCTIONNALITÉS ADMIN =====

// Configurer les event listeners pour les fonctionnalités admin
function setupAdminEventListeners() {
    // Statistiques globales
    const viewGlobalStatsBtn = document.getElementById('view-global-stats');
    if (viewGlobalStatsBtn) {
        viewGlobalStatsBtn.addEventListener('click', showGlobalStats);
    }
    
    // Gestion des utilisateurs
    const manageUsersBtn = document.getElementById('manage-users');
    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', showUsersManagement);
    }
    
    // Réinitialiser progression
    const resetUserProgressBtn = document.getElementById('reset-user-progress');
    if (resetUserProgressBtn) {
        resetUserProgressBtn.addEventListener('click', resetUserProgress);
    }
    

    
    // Export des données
    const exportDataBtn = document.getElementById('export-data');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportAllData);
    }
    
    // Mettre à jour la taille de la grille
    const updateGridSizeBtn = document.getElementById('update-grid-size');
    if (updateGridSizeBtn) {
        updateGridSizeBtn.addEventListener('click', updateGridSize);
    }
    
    // Fermer les modals
    const closeStatsBtn = document.getElementById('close-stats');
    const closeUsersBtn = document.getElementById('close-users');
    
    if (closeStatsBtn) {
        closeStatsBtn.addEventListener('click', () => {
            document.getElementById('stats-modal').style.display = 'none';
        });
    }
    
    if (closeUsersBtn) {
        closeUsersBtn.addEventListener('click', () => {
            document.getElementById('users-modal').style.display = 'none';
        });
    }
}

// Afficher les statistiques globales
async function showGlobalStats() {
    if (!hasPermission('manage_users')) {
        showNotification('Accès refusé', 'error');
        return;
    }
    
    const statsModal = document.getElementById('stats-modal');
    const statsContent = document.getElementById('stats-content');
    
    statsContent.innerHTML = '<p>Chargement des statistiques...</p>';
    statsModal.style.display = 'flex';
    
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const usersSnapshot = await getDocs(collection(window.db, 'users'));
        
        let totalUsers = 0;
        let totalCaptured = 0;
        let totalPokemon = 0;
        let usersWithProgress = 0;
        let averageCompletion = 0;
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            totalUsers++;
            
            if (userData.capturedPokemon && userData.capturedPokemon.length > 0) {
                usersWithProgress++;
                totalCaptured += userData.capturedPokemon.length;
                totalPokemon += TOTAL_POKEMON;
            }
        });
        
        averageCompletion = usersWithProgress > 0 ? (totalCaptured / totalPokemon * 100).toFixed(1) : 0;
        
        statsContent.innerHTML = `
            <div class="stats-grid">
                <div class="global-stat-card">
                    <div class="global-stat-number">${totalUsers}</div>
                    <div class="global-stat-label">Utilisateurs totaux</div>
                </div>
                <div class="global-stat-card">
                    <div class="global-stat-number">${usersWithProgress}</div>
                    <div class="global-stat-label">Utilisateurs actifs</div>
                </div>
                <div class="global-stat-card">
                    <div class="global-stat-number">${totalCaptured}</div>
                    <div class="global-stat-label">Pokémon capturés</div>
                </div>
                <div class="global-stat-card">
                    <div class="global-stat-number">${averageCompletion}%</div>
                    <div class="global-stat-label">Complétion moyenne</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
        statsContent.innerHTML = '<p>Erreur lors du chargement des statistiques</p>';
    }
}

// Afficher la gestion des utilisateurs
async function showUsersManagement() {
    if (!hasPermission('manage_users')) {
        showNotification('Accès refusé', 'error');
        return;
    }
    const usersModal = document.getElementById('users-modal');
    const usersTableRoot = document.getElementById('users-table-root');
    const usersEmptyMsg = document.getElementById('users-empty-message');
    const searchInput = document.getElementById('users-search-input');
    // Sécurité : vérifie que tous les éléments existent
    if (!usersModal || !usersTableRoot || !usersEmptyMsg || !searchInput) {
        alert("Erreur critique : certains éléments de la modale utilisateurs sont manquants dans le DOM.\nVérifiez le HTML et rechargez la page.");
        return;
    }
    usersTableRoot.innerHTML = '<p style="text-align:center;color:#667eea;">Chargement des utilisateurs...</p>';
    usersEmptyMsg.style.display = 'none';
    usersModal.style.display = 'flex';
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const usersSnapshot = await getDocs(collection(window.db, 'users'));
        allUsersList = [];
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            allUsersList.push({
                uid: doc.id,
                username: userData.username || '',
                email: userData.email || '',
                role: userData.role || 'member',
                avatar: userData.avatar || '👤',
                capturedCount: userData.capturedPokemon ? userData.capturedPokemon.length : 0,
                completion: ((userData.capturedPokemon ? userData.capturedPokemon.length : 0) / TOTAL_POKEMON * 100).toFixed(1),
                lastActivity: userData.lastSaved ? new Date(userData.lastSaved.toDate()).toLocaleDateString('fr-FR') : 'Jamais'
            });
        });
        filteredUsersList = [...allUsersList];
        renderUsersTable(filteredUsersList);
        // Event listener recherche
        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = function() {
                filterUsersTable(this.value);
            };
        }
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        usersTableRoot.innerHTML = '<p style="color:red;text-align:center;">Erreur lors du chargement des utilisateurs</p>';
    }
}

function filterUsersTable(query) {
    const usersTableRoot = document.getElementById('users-table-root');
    const usersEmptyMsg = document.getElementById('users-empty-message');
    query = (query || '').toLowerCase();
    filteredUsersList = allUsersList.filter(u =>
        u.username.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
    );
    renderUsersTable(filteredUsersList);
    if (filteredUsersList.length === 0) {
        usersEmptyMsg.style.display = 'block';
    } else {
        usersEmptyMsg.style.display = 'none';
    }
}

function renderUsersTable(users) {
    const usersTableRoot = document.getElementById('users-table-root');
    if (!users || users.length === 0) {
        usersTableRoot.innerHTML = '';
        return;
    }
    let html = '';
    users.forEach(user => {
        let dateStr = user.lastActivity;
        if (dateStr && dateStr.length === 10 && dateStr.includes('/')) {
            // Format atte²ndu : JJ/MM/AAAA
            const [jour, mois, annee] = dateStr.split('/');
            dateStr = `<span>${jour}/${mois}/${annee}</span>`;
        }
        let avatarHtml = user.avatar ?
            `<img class="user-card-avatar-img" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${user.avatar}.png" alt="Avatar" style="width:32px;height:32px;object-fit:contain;cursor:pointer;" onclick="showUserAvatarModal('${user.uid}', '${user.username.replace(/'/g, "&#39;")}')" title="Cliquer pour changer l'avatar" />`
            : `<img class="user-card-avatar-img" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" alt="Pokéball" style="width:32px;height:32px;object-fit:contain;cursor:pointer;" onclick="showUserAvatarModal('${user.uid}', '${user.username.replace(/'/g, "&#39;")}')" title="Cliquer pour changer l'avatar" />`;
        html += `
        <div class="user-card" data-uid="${user.uid}">
            <div class="user-card-header">
                <div class="user-card-avatar">
                    ${avatarHtml}
                </div>
                <div class="user-card-info">
                    <span class="user-card-username">${user.username || 'N/A'}</span>
                    <span class="user-card-badge ${user.role}" data-uid="${user.uid}" data-current-role="${user.role}" style="cursor: pointer;" title="Cliquer pour changer le rôle">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                </div>
            </div>
            <div class="user-card-email">${user.email || ''}</div>
            <div class="user-card-stats">
                <span><b>${user.capturedCount || 0}</b> capturés</span> · 
                <span><b>${user.completion || '0'}%</b> complétion</span><br>
                <span style='font-size:0.93em;color:#aaa;'>Dernière activité : ${dateStr}</span>
            </div>
            <div class="user-card-actions">
                <button class="user-card-btn" onclick="showUserCollectionModal('${user.uid}', '${user.username.replace(/'/g, "&#39;")}', ${user.capturedCount || 0}, '${user.completion || '0'}')" title="Voir la collection">🃏 Collection</button>
                <button class="user-card-btn danger" onclick="resetUserProgressById('${user.uid}')" title="Réinitialiser progression">🔄 Réinitialiser</button>
            </div>
        </div>
        `;
    });
    usersTableRoot.innerHTML = html;
    setupRoleBadgeClickHandlers();
}

// Variables globales pour la collection d'utilisateur
let currentCollectionFilter = 'number'; // 'number' ou 'capture'
let currentCollectionData = null;
let currentCollectionUid = null;

// Afficher la collection d'un utilisateur dans un modal (admin)
window.showUserCollectionModal = async function(uid, username, capturedCount, completion) {
    const modal = document.getElementById('user-collection-modal');
    const grid = document.getElementById('user-collection-grid');
    const emptyMsg = document.getElementById('user-collection-empty');
    const nameSpan = document.getElementById('collection-username');
    const statsSpan = document.getElementById('collection-stats');
    if (!modal || !grid || !emptyMsg || !nameSpan || !statsSpan) return;
    
    // Réinitialiser le filtre par défaut
    currentCollectionFilter = 'number';
    currentCollectionUid = uid;
    
    nameSpan.textContent = username || uid;
    statsSpan.innerHTML = `<span class='captured'>${capturedCount || 0} capturés</span><span class='completion'>${completion || '0'}% complétion</span>`;
    grid.innerHTML = '<p style="text-align:center;color:#667eea;">Chargement de la collection...</p>';
    emptyMsg.style.display = 'none';
    modal.style.display = 'flex';
    
    // Mettre à jour l'état des boutons de filtre
    updateCollectionFilterButtons();
    
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(window.db, 'users', uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const captured = userData.capturedPokemon || [];
            
            // Stocker les données pour les filtres
            currentCollectionData = {
                captured: captured,
                captureDates: userData.captureDates || {}
            };
            
            if (captured.length === 0) {
                grid.innerHTML = '';
                emptyMsg.style.display = 'block';
            } else {
                displayCollectionWithFilter();
            }
        } else {
            grid.innerHTML = '';
            emptyMsg.style.display = 'block';
        }
    } catch (e) {
        grid.innerHTML = '<p style="color:red;text-align:center;">Erreur lors du chargement</p>';
        emptyMsg.style.display = 'none';
    }
};

// Mettre à jour l'état des boutons de filtre
function updateCollectionFilterButtons() {
    const numberBtn = document.getElementById('collection-filter-number');
    const captureBtn = document.getElementById('collection-filter-capture');
    
    if (numberBtn && captureBtn) {
        numberBtn.classList.toggle('active', currentCollectionFilter === 'number');
        captureBtn.classList.toggle('active', currentCollectionFilter === 'capture');
    }
}

// Afficher la collection avec le filtre actuel
function displayCollectionWithFilter() {
    const grid = document.getElementById('user-collection-grid');
    const emptyMsg = document.getElementById('user-collection-empty');
    
    if (!currentCollectionData || !grid || !emptyMsg) return;
    
    const { captured, captureDates } = currentCollectionData;
    
    if (captured.length === 0) {
        grid.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }
    
    // Trier selon le filtre actuel
    let sortedPokemon = [...captured];
    
    if (currentCollectionFilter === 'number') {
        // Trier par numéro de Pokémon (ordre par défaut)
        sortedPokemon.sort((a, b) => a - b);
    } else if (currentCollectionFilter === 'capture') {
        // Trier par ordre de capture (plus ancien au plus récent)
        sortedPokemon.sort((a, b) => {
            const dateA = captureDates[a] || new Date(0);
            const dateB = captureDates[b] || new Date(0);
            return new Date(dateA) - new Date(dateB);
        });
    }
    
    // Afficher les Pokémon
    grid.innerHTML = '';
    sortedPokemon.forEach(num => {
        // Récupérer le nom du Pokémon depuis la liste
        let pokemonName = `#${num}`;
        if (pokemonList && pokemonList[num-1]) {
            pokemonName = pokemonList[num-1] || `#${num}`;
        }
        
        const card = document.createElement('div');
        card.className = 'pokemon-card captured';
        card.dataset.pokemonNumber = num;
        
        // Ajouter la date de capture si disponible
        let captureInfo = '';
        if (currentCollectionFilter === 'capture' && captureDates[num]) {
            const captureDate = new Date(captureDates[num]);
            const day = captureDate.getDate().toString().padStart(2, '0');
            const month = (captureDate.getMonth() + 1).toString().padStart(2, '0');
            const year = captureDate.getFullYear();
            captureInfo = `<div class="pokemon-capture-date">${day}/${month}/${year}</div>`;
        }
        
        card.innerHTML = `
            <div class="pokemon-number">#${num.toString().padStart(3, '0')}</div>
            <div class="pokemon-name">${pokemonName}</div>
            ${captureInfo}
        `;
        
        if (typeof loadPokemonImage === 'function') {
            loadPokemonImage(card, num);
        }
        grid.appendChild(card);
    });
    
    emptyMsg.style.display = 'none';
}

// Gérer le changement de filtre de collection
window.changeCollectionFilter = function(filter) {
    if (filter === currentCollectionFilter) return;
    
    currentCollectionFilter = filter;
    updateCollectionFilterButtons();
    displayCollectionWithFilter();
};

// Fermer le modal de collection
const closeCollectionBtn = document.getElementById('close-collection');
if (closeCollectionBtn) {
    closeCollectionBtn.addEventListener('click', () => {
        document.getElementById('user-collection-modal').style.display = 'none';
    });
}

// Réinitialiser la progression d'un utilisateur
async function resetUserProgress() {
    if (!hasPermission('manage_users')) {
        showNotification('Accès refusé', 'error');
        return;
    }
    
    const uid = document.getElementById('reset-user-uid').value.trim();
    if (!uid) {
        showNotification('Veuillez entrer un UID utilisateur', 'error');
        return;
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir réinitialiser la progression de l'utilisateur ${uid} ?`)) {
        return;
    }
    
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        await updateDoc(doc(window.db, 'users', uid), {
            capturedPokemon: [],
            lastSaved: new Date()
        });
        
        showNotification('Progression réinitialisée avec succès', 'success');
        document.getElementById('reset-user-uid').value = '';
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        showNotification('Erreur lors de la réinitialisation', 'error');
    }
}



// Exporter toutes les données
async function exportAllData() {
    if (!hasPermission('manage_users')) {
        showNotification('Accès refusé', 'error');
        return;
    }
    
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const usersSnapshot = await getDocs(collection(window.db, 'users'));
        
        const exportData = {
            exportDate: new Date().toISOString(),
            totalUsers: 0,
            users: []
        };
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            exportData.totalUsers++;
            exportData.users.push({
                uid: doc.id,
                ...userData,
                lastSaved: userData.lastSaved ? userData.lastSaved.toDate().toISOString() : null,
                createdAt: userData.createdAt ? userData.createdAt.toDate().toISOString() : null
            });
        });
        
        // Créer et télécharger le fichier JSON
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `pokemon-challenge-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification('Données exportées avec succès', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        showNotification('Erreur lors de l\'export', 'error');
    }
}





// Configurer les sélecteurs de rôle
function setupRoleBadgeClickHandlers() {
    const roleBadges = document.querySelectorAll('.user-card-badge');
    
    roleBadges.forEach(badge => {
        badge.addEventListener('click', async function() {
            const uid = this.dataset.uid;
            const currentRole = this.dataset.currentRole;
            
            // Cycle through roles: member -> tester -> admin -> member
            let newRole;
            switch(currentRole) {
                case 'member':
                    newRole = 'tester';
                    break;
                case 'tester':
                    newRole = 'admin';
                    break;
                case 'admin':
                    newRole = 'member';
                    break;
                default:
                    newRole = 'member';
            }
            
            // Update the badge immediately for better UX
            this.textContent = newRole.charAt(0).toUpperCase() + newRole.slice(1);
            this.className = `user-card-badge ${newRole}`;
            this.dataset.currentRole = newRole;
            
            // Update the role in Firebase
            await updateUserRole(uid, newRole);
        });
    });
}

// Mettre à jour le rôle d'un utilisateur
async function updateUserRole(uid, newRole) {
    if (!hasPermission('manage_users')) {
        showNotification('Accès refusé', 'error');
        return;
    }
    
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        await updateDoc(doc(window.db, 'users', uid), {
            role: newRole
        });
        
        showNotification(`Rôle mis à jour : ${newRole}`, 'success');
    } catch (error) {
        console.error('Erreur lors de la mise à jour du rôle:', error);
        showNotification('Erreur lors de la mise à jour du rôle', 'error');
        
        // Revert the badge if the update failed
        const badge = document.querySelector(`.user-card-badge[data-uid="${uid}"]`);
        if (badge) {
            const currentRole = badge.dataset.currentRole;
            badge.textContent = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);
            badge.className = `user-card-badge ${currentRole}`;
        }
    }
}

// Réinitialiser la progression d'un utilisateur par ID
async function resetUserProgressById(uid) {
    if (!hasPermission('manage_users')) {
        showNotification('Accès refusé', 'error');
        return;
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir réinitialiser la progression de cet utilisateur ?`)) {
        return;
    }
    
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        await updateDoc(doc(window.db, 'users', uid), {
            capturedPokemon: [],
            lastSaved: new Date()
        });
        
        showNotification('Progression réinitialisée avec succès', 'success');
        
        // Recharger le tableau pour mettre à jour les données
        showUsersManagement();
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        showNotification('Erreur lors de la réinitialisation', 'error');
    }
}

// Mettre à jour la taille de la grille
async function updateGridSize() {
    if (!hasPermission('manage_users')) {
        showNotification('Accès refusé', 'error');
        return;
    }
    
    const newSize = parseInt(document.getElementById('pokemon-per-page').value);
    if (isNaN(newSize) || newSize < 4 || newSize > 50) {
        showNotification('Veuillez entrer un nombre entre 4 et 50', 'error');
        return;
    }
    
    // Mettre à jour les variables globales
    POKEMON_PER_PAGE = newSize;
    TOTAL_PAGES = Math.ceil(TOTAL_POKEMON / POKEMON_PER_PAGE);
    
    // Mettre à jour l'affichage
    currentPage = 1;
    await displayCurrentPage();
    updateStats();
    
    // Mettre à jour le texte de pagination
    const pageInfo = document.querySelector('.page-info');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} / ${TOTAL_PAGES}`;
    }
    
    showNotification(`Grille mise à jour : ${newSize} Pokémon par page`, 'success');
}

// Afficher un message de bienvenue
window.addEventListener('load', () => {
    setTimeout(() => {
        showNotification('Bienvenue dans le Pokédex National ! 🎮', 'info');
    }, 1000);
});

// Fonction pour gérer le Pokémon aléatoire
async function handleRandomPokemon() {
    const randomBtn = document.getElementById('random-pokemon-btn');
    const modal = document.getElementById('random-pokemon-modal');
    const spinner = document.querySelector('.random-pokemon-spinner');
    const result = document.querySelector('.random-pokemon-result');
    
    if (!randomBtn || !modal) return;
    
    // Afficher le modal avec le spinner
    modal.style.display = 'flex';
    spinner.style.display = 'flex';
    result.style.display = 'none';
    
    // Générer un numéro de Pokémon aléatoire selon le paramètre
    let randomPokemonNumber;
    let pokemonName;
    
    if (randomUncapturedOnly) {
        // Générer uniquement parmi les Pokémon non capturés
        const uncapturedPokemon = [];
        for (let i = 1; i <= TOTAL_POKEMON; i++) {
            if (!capturedPokemon.has(i)) {
                uncapturedPokemon.push(i);
            }
        }
        
        if (uncapturedPokemon.length === 0) {
            showNotification('🎉 Félicitations ! Vous avez capturé tous les Pokémon !', 'success');
            modal.style.display = 'none';
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * uncapturedPokemon.length);
        randomPokemonNumber = uncapturedPokemon[randomIndex];
        pokemonName = pokemonList[randomPokemonNumber - 1];
        
        console.log(`[RANDOM] Pokémon aléatoire non capturé sélectionné : #${randomPokemonNumber} - ${pokemonName}`);
    } else {
        // Générer parmi tous les Pokémon
        randomPokemonNumber = Math.floor(Math.random() * TOTAL_POKEMON) + 1;
        pokemonName = pokemonList[randomPokemonNumber - 1];
        
        console.log(`[RANDOM] Pokémon aléatoire sélectionné : #${randomPokemonNumber} - ${pokemonName}`);
    }
    
    // Attendre 2 secondes pour l'animation du spinner
    setTimeout(async () => {
        // Cacher le spinner et afficher le résultat
        spinner.style.display = 'none';
        result.style.display = 'flex';
        
        // Remplir les informations du Pokémon
        document.getElementById('random-pokemon-number').textContent = `#${randomPokemonNumber.toString().padStart(3, '0')}`;
        document.getElementById('random-pokemon-name').textContent = pokemonName;
        
        // Charger l'image du Pokémon
        const imageElement = document.getElementById('random-pokemon-image');
        const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${randomPokemonNumber}.png`;
        
        const img = new Image();
        img.onload = () => {
            imageElement.style.backgroundImage = `url(${imageUrl})`;
        };
        img.onerror = () => {
            console.warn(`Impossible de charger l'image pour le Pokémon #${randomPokemonNumber}`);
            imageElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        };
        img.src = imageUrl;
        
        // Configurer les boutons d'action
        setupRandomPokemonActions(randomPokemonNumber);
        
    }, 2000);
}

// Fonction pour l'ajout rapide de Pokémon
async function handleQuickAdd() {
    // Afficher le modal d'ajout rapide
    showQuickAddModal();
}

// Fonction pour afficher le modal d'ajout rapide
function showQuickAddModal() {
    const modal = document.getElementById('quick-add-modal');
    const textarea = document.getElementById('quick-add-input');
    const preview = document.getElementById('quick-add-preview');
    
    // Réinitialiser le modal
    textarea.value = '';
    preview.style.display = 'none';
    
    // Afficher le modal
    modal.style.display = 'flex';
    
    // Focus sur le textarea
    setTimeout(() => {
        textarea.focus();
    }, 100);
    
    // Configurer les événements
    setupQuickAddEventListeners();
}

// Fonction pour configurer les événements du modal d'ajout rapide
function setupQuickAddEventListeners() {
    const modal = document.getElementById('quick-add-modal');
    const textarea = document.getElementById('quick-add-input');
    const preview = document.getElementById('quick-add-preview');
    const confirmBtn = document.getElementById('confirm-quick-add');
    const cancelBtn = document.getElementById('cancel-quick-add');
    const closeBtn = document.getElementById('close-quick-add');
    
    // Événement de saisie pour la prévisualisation
    textarea.addEventListener('input', () => {
        updateQuickAddPreview();
    });
    
    // Bouton confirmer
    confirmBtn.onclick = async () => {
        await processQuickAdd();
    };
    
    // Bouton annuler
    cancelBtn.onclick = () => {
        closeQuickAddModal();
    };
    
    // Bouton fermer
    closeBtn.onclick = () => {
        closeQuickAddModal();
    };
    
    // Fermer avec Escape
    document.addEventListener('keydown', function handleEscape(e) {
        if (e.key === 'Escape') {
            closeQuickAddModal();
            document.removeEventListener('keydown', handleEscape);
        }
    });
}

// Fonction pour mettre à jour la prévisualisation
function updateQuickAddPreview() {
    const textarea = document.getElementById('quick-add-input');
    const preview = document.getElementById('quick-add-preview');
    const previewNumbers = document.getElementById('preview-numbers');
    const previewStats = document.getElementById('preview-stats');
    
    const userInput = textarea.value.trim();
    
    if (!userInput) {
        preview.style.display = 'none';
        return;
    }
    
    // Parser l'entrée utilisateur
    let quickAddNumbers = [];
    try {
        quickAddNumbers = userInput
            .split(',')
            .map(num => num.trim())
            .filter(num => num !== '')
            .map(num => parseInt(num))
            .filter(num => !isNaN(num) && num >= 1 && num <= TOTAL_POKEMON);
    } catch (error) {
        preview.style.display = 'none';
        return;
    }
    
    if (quickAddNumbers.length === 0) {
        preview.style.display = 'none';
        return;
    }
    
    // Afficher la prévisualisation
    preview.style.display = 'block';
    
    // Afficher les cartes Pokémon
    previewNumbers.innerHTML = '';
    quickAddNumbers.forEach(num => {
        const isAlreadyCaptured = capturedPokemon.has(num);
        const pokemonName = pokemonNamesData[num - 1]?.french || `Pokémon #${num}`;
        
        // Créer une carte Pokémon miniature
        const card = document.createElement('div');
        card.className = `preview-pokemon-card ${isAlreadyCaptured ? 'already-captured' : ''}`;
        card.dataset.pokemonNumber = num;
        
        card.innerHTML = `
            <div class="preview-pokemon-number">#${num.toString().padStart(3, '0')}</div>
            <div class="preview-pokemon-name">${pokemonName}</div>
        `;
        
        // Charger l'image de fond pour ce Pokémon
        loadPreviewPokemonImage(card, num);
        
        previewNumbers.appendChild(card);
    });
    
    // Afficher les statistiques
    const alreadyCaptured = quickAddNumbers.filter(num => capturedPokemon.has(num));
    const newToAdd = quickAddNumbers.filter(num => !capturedPokemon.has(num));
    
    previewStats.innerHTML = `
        <div class="preview-stat">
            <span>Total : <span class="stat-value">${quickAddNumbers.length}</span></span>
        </div>
        <div class="preview-stat">
            <span>Nouveaux : <span class="stat-value">${newToAdd.length}</span></span>
        </div>
        <div class="preview-stat">
            <span>Déjà capturés : <span class="stat-value">${alreadyCaptured.length}</span></span>
        </div>
    `;
}

// Fonction pour charger l'image d'un Pokémon dans la prévisualisation
async function loadPreviewPokemonImage(card, pokemonNumber) {
    try {
        // URL de l'image officielle de Pokémon
        const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonNumber}.png`;
        
        // Créer un élément image pour précharger
        const img = new Image();
        
        img.onload = () => {
            // Une fois l'image chargée, l'ajouter comme fond
            card.style.backgroundImage = `url(${imageUrl})`;
            card.style.backgroundSize = 'cover';
            card.style.backgroundPosition = 'center';
            card.style.backgroundRepeat = 'no-repeat';
            
            // Ajouter un overlay semi-transparent pour améliorer la lisibilité du texte
            card.style.position = 'relative';
            
            // Créer l'overlay
            let overlay = card.querySelector('.preview-card-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'preview-card-overlay';
                card.appendChild(overlay);
            }
            
            // Mettre à jour l'overlay avec la bonne couleur selon l'état de capture
            const isCaptured = capturedPokemon.has(pokemonNumber);
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: ${isCaptured 
                    ? 'linear-gradient(135deg, rgba(78, 205, 196, 0.4) 0%, rgba(68, 160, 141, 0.2) 50%, rgba(78, 205, 196, 0.5) 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%)'
                };
                pointer-events: none;
                z-index: 1;
            `;
            
            // S'assurer que le texte reste au-dessus de l'overlay
            const numberElement = card.querySelector('.preview-pokemon-number');
            const nameElement = card.querySelector('.preview-pokemon-name');
            if (numberElement) numberElement.style.zIndex = '2';
            if (nameElement) nameElement.style.zIndex = '2';
        };
        
        img.onerror = () => {
            // En cas d'erreur, utiliser une image par défaut ou un motif
            console.warn(`Impossible de charger l'image pour le Pokémon #${pokemonNumber} dans la prévisualisation`);
            card.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            
            // Créer quand même l'overlay même en cas d'erreur
            card.style.position = 'relative';
            let overlay = card.querySelector('.preview-card-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'preview-card-overlay';
                const isCaptured = capturedPokemon.has(pokemonNumber);
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: ${isCaptured 
                        ? 'linear-gradient(135deg, rgba(78, 205, 196, 0.4) 0%, rgba(68, 160, 141, 0.2) 50%, rgba(78, 205, 196, 0.5) 100%)'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%)'
                    };
                    pointer-events: none;
                    z-index: 1;
                `;
                card.appendChild(overlay);
            }
        };
        
        // Démarrer le chargement
        img.src = imageUrl;
        
    } catch (error) {
        console.error(`Erreur lors du chargement de l'image pour le Pokémon #${pokemonNumber} dans la prévisualisation:`, error);
    }
}

// Fonction pour traiter l'ajout rapide
async function processQuickAdd() {
    const textarea = document.getElementById('quick-add-input');
    const userInput = textarea.value.trim();
    
    if (!userInput) {
        showNotification('Aucun numéro de Pokémon saisi.', 'info');
        return;
    }
    
    // Parser l'entrée utilisateur
    let quickAddNumbers = [];
    try {
        quickAddNumbers = userInput
            .split(',')
            .map(num => num.trim())
            .filter(num => num !== '')
            .map(num => parseInt(num))
            .filter(num => !isNaN(num) && num >= 1 && num <= TOTAL_POKEMON);
    } catch (error) {
        showNotification('Format invalide. Veuillez entrer des numéros séparés par des virgules.', 'error');
        return;
    }
    
    if (quickAddNumbers.length === 0) {
        showNotification('Aucun numéro de Pokémon valide trouvé.', 'error');
        return;
    }
    
    // Compter combien de Pokémon sont déjà capturés
    const alreadyCaptured = quickAddNumbers.filter(num => capturedPokemon.has(num));
    const newToAdd = quickAddNumbers.filter(num => !capturedPokemon.has(num));
    
    if (newToAdd.length === 0) {
        showNotification('Tous ces Pokémon sont déjà capturés !', 'info');
        closeQuickAddModal();
        return;
    }
    
    // Ajouter les Pokémon non capturés
    let addedCount = 0;
    for (const pokemonNumber of newToAdd) {
        if (!capturedPokemon.has(pokemonNumber)) {
            capturedPokemon.add(pokemonNumber);
            addedCount++;
        }
    }
    
    // Mettre à jour l'affichage
    updateStats();
    
    // Mettre à jour les cartes des Pokémon ajoutés
    newToAdd.forEach(num => {
        updatePokemonCard(num);
    });
    
    // Sauvegarder les données
    try {
        await saveUserDataImmediate();
        showNotification(`⚡ Ajout rapide terminé ! ${addedCount} nouveaux Pokémon capturés.`, 'success');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde après ajout rapide:', error);
        saveUserData();
        showNotification(`⚡ Ajout rapide terminé ! ${addedCount} nouveaux Pokémon capturés.`, 'success');
    }
    
    // Fermer le modal
    closeQuickAddModal();
}

// Fonction pour fermer le modal d'ajout rapide
function closeQuickAddModal() {
    const modal = document.getElementById('quick-add-modal');
    modal.style.display = 'none';
}

// Configurer les actions du Pokémon aléatoire
function setupRandomPokemonActions(pokemonNumber) {
    const captureBtn = document.getElementById('capture-random-pokemon');
    const goToBtn = document.getElementById('go-to-random-pokemon');
    const closeBtn = document.getElementById('close-random-pokemon');
    const modal = document.getElementById('random-pokemon-modal');
    
    // Bouton capturer
    if (captureBtn) {
        captureBtn.onclick = async () => {
            const wasCaptured = capturedPokemon.has(pokemonNumber);
            if (!wasCaptured) {
                capturedPokemon.add(pokemonNumber);
                updatePokemonCard(pokemonNumber);
                updateStats();
                try {
                    await saveUserDataImmediate();
                    showNotification(`🎉 Pokémon #${pokemonNumber} capturé !`, 'success');
                } catch (error) {
                    saveUserData();
                }
            } else {
                showNotification(`✅ Pokémon #${pokemonNumber} déjà capturé !`, 'info');
            }
            modal.style.display = 'none';
        };
    }
    
    // Bouton aller à la grille
    if (goToBtn) {
        goToBtn.onclick = async () => {
            modal.style.display = 'none';
            await goToPokemon(pokemonNumber);
        };
    }
    
    // Bouton fermer
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    // Fermer en cliquant en dehors du modal
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
}

// ===== SYSTÈME DE RÔLES ===== 

// ===== FONCTIONS D'EXPORT =====

// Fonction pour gérer l'export de la liste des Pokémon
function handleExportPokemonList() {
    // Afficher le modal d'export
    showExportPokemonModal();
}

// Fonction pour afficher le modal d'export
function showExportPokemonModal() {
    const modal = document.getElementById('export-pokemon-modal');
    const exportTextarea = document.getElementById('export-pokemon-list-text');
    
    if (!modal || !exportTextarea) return;
    
    // Convertir le Set en Array et trier par numéro
    const capturedArray = Array.from(capturedPokemon).sort((a, b) => a - b);
    
    // Créer la liste formatée
    const pokemonList = capturedArray.join(', ');
    
    // Afficher dans le textarea
    exportTextarea.value = pokemonList;
    
    // Afficher le modal
    modal.style.display = 'flex';
    
    // Configurer les événements
    setupExportPokemonEventListeners();
    
    showNotification('📋 Liste des Pokémon exportée !', 'success');
}

// Fonction pour configurer les événements du modal d'export
function setupExportPokemonEventListeners() {
    const modal = document.getElementById('export-pokemon-modal');
    const copyBtn = document.getElementById('copy-pokemon-list-btn');
    const closeBtn = document.getElementById('close-export-pokemon');
    const closeBtnSecondary = document.getElementById('close-export-pokemon-btn');
    
    // Bouton copier
    if (copyBtn) {
        copyBtn.onclick = async () => {
            await handleCopyPokemonList();
        };
    }
    
    // Boutons fermer
    if (closeBtn) {
        closeBtn.onclick = () => {
            closeExportPokemonModal();
        };
    }
    
    if (closeBtnSecondary) {
        closeBtnSecondary.onclick = () => {
            closeExportPokemonModal();
        };
    }
    
    // Fermer en cliquant en dehors
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeExportPokemonModal();
            }
        };
    }
    
    // Fermer avec Escape
    document.addEventListener('keydown', function handleEscape(e) {
        if (e.key === 'Escape') {
            closeExportPokemonModal();
            document.removeEventListener('keydown', handleEscape);
        }
    });
}

// Fonction pour fermer le modal d'export
function closeExportPokemonModal() {
    const modal = document.getElementById('export-pokemon-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fonction pour copier la liste des Pokémon
async function handleCopyPokemonList() {
    const exportTextarea = document.getElementById('export-pokemon-list-text');
    
    if (!exportTextarea || !exportTextarea.value) {
        showNotification('Aucune liste à copier', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(exportTextarea.value);
        showNotification('📋 Liste copiée dans le presse-papiers !', 'success');
    } catch (error) {
        // Fallback pour les navigateurs qui ne supportent pas l'API Clipboard
        exportTextarea.select();
        exportTextarea.setSelectionRange(0, 99999); // Pour mobile
        document.execCommand('copy');
        showNotification('📋 Liste copiée dans le presse-papiers !', 'success');
    }
}