// Configuration
const TOTAL_POKEMON = 1025;
let POKEMON_PER_PAGE = 16; // 4x4 grille
let TOTAL_PAGES = Math.ceil(TOTAL_POKEMON / POKEMON_PER_PAGE);

// Variables globales
let currentPage = 1;
let capturedPokemon = new Set();
let pokemonList = [];
let currentFilter = 'all'; // 'all', 'captured', 'missing'
let currentUser = null;

// Variables pour le système de rôles
let userRole = 'member'; // 'member', 'tester', 'admin'
let allUsers = [];
let isDarkMode = false;

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


// Variables pour la recherche
let searchTimeout = null;
let selectedResultIndex = -1;
let currentSearchResults = [];

// Fonction pour récupérer tous les noms de Pokémon en français depuis PokéAPI
async function fetchFrenchPokemonNames() {
    console.log('[PokéAPI] Début du chargement de la liste des espèces...');
    const speciesListResp = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1025');
    const speciesList = await speciesListResp.json();
    const urls = speciesList.results.map(s => s.url);
    console.log(`[PokéAPI] ${urls.length} URLs d'espèces à traiter.`);

    // Pour aller plus vite, on limite à 50 requêtes en parallèle
    const chunkSize = 50;
    let names = [];
    for (let i = 0; i < urls.length; i += chunkSize) {
        const chunk = urls.slice(i, i + chunkSize);
        console.log(`[PokéAPI] Traitement du chunk ${i/chunkSize+1} (${i+1} à ${i+chunk.length})...`);
        const chunkResults = await Promise.all(chunk.map(async (url, idx) => {
            try {
                const resp = await fetch(url);
                const data = await resp.json();
                const frName = data.names.find(n => n.language.name === 'fr');
                if (frName) {
                    console.log(`[PokéAPI] #${data.id} : ${frName.name}`);
                } else {
                    console.warn(`[PokéAPI] #${data.id} : nom FR non trouvé, fallback sur ${data.name}`);
                }
                return frName ? frName.name : data.name;
            } catch (e) {
                console.error(`[PokéAPI] Erreur sur ${url} :`, e);
                return null;
            }
        }));
        names = names.concat(chunkResults.filter(Boolean));
        console.log(`[PokéAPI] ${names.length} noms collectés jusqu'ici.`);
    }
    console.log(`[PokéAPI] Chargement terminé. Total : ${names.length} noms.`);
    return names;
}

// Initialisation
async function init() {
    try {
        let pokemonListCache = localStorage.getItem('pokemonListFR');
        if (pokemonListCache) {
            pokemonList = JSON.parse(pokemonListCache);
            console.log('[PokéAPI] Liste des Pokémon FR chargée depuis le cache localStorage');
        } else {
            pokemonGrid.innerHTML = '<p style="text-align: center; color: #667eea;">Chargement de la liste des Pokémon en français...<br>Ce chargement peut prendre 10 à 30 secondes la première fois.</p>';
            console.log('[PokéAPI] Aucun cache trouvé, chargement depuis PokéAPI...');
            pokemonList = await fetchFrenchPokemonNames();
            localStorage.setItem('pokemonListFR', JSON.stringify(pokemonList));
            console.log('[PokéAPI] Liste des Pokémon FR chargée depuis PokéAPI et mise en cache');
        }
        // Initialiser l'authentification Firebase
        initAuth();
        console.log(`[PokéAPI] Application initialisée avec ${pokemonList.length} Pokémon (noms FR dynamiques)`);
    } catch (error) {
        console.error('Erreur lors du chargement des Pokémon:', error);
        pokemonGrid.innerHTML = '<p style="text-align: center; color: red;">Erreur lors du chargement des données</p>';
    }
}

// Initialiser l'authentification Firebase
function initAuth() {
    console.log('Initialisation de l\'authentification Firebase...');
    
    // Vérifier que Firebase est disponible
    if (!window.auth) {
        console.error('Firebase Auth n\'est pas disponible');
        showNotification('Erreur: Firebase non initialisé', 'error');
        return;
    }
    
    // Écouter les changements d'état d'authentification
    window.auth.onAuthStateChanged(async (user) => {
        console.log('État d\'authentification changé:', user ? user.email : 'Déconnecté');
        
        if (user) {
            // Utilisateur connecté
            currentUser = user;
            console.log('Utilisateur connecté:', user.email);
            
            showApp();
            await loadUserData();
            await loadUserRole(); // Charger le rôle de l'utilisateur
            
            // Vérifier le mode maintenance après avoir chargé le rôle
            const canAccess = await checkMaintenanceMode();
            if (!canAccess) {
                return; // Arrêter ici si en maintenance
            }
            
            setupEventListeners();
            setupSettingsModal(); // Configurer le modal des paramètres
            displayCurrentPage();
            updateStats();
            setFilter(currentFilter);
            applyDarkMode(); // Appliquer le mode sombre si activé
        } else {
            // Utilisateur déconnecté
            currentUser = null;
            console.log('Utilisateur déconnecté');
            showAuth();
        }
    });
    
    // Configurer les event listeners d'authentification
    setupAuthEventListeners();
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
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayCurrentPage();
            updateStats();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        if (currentPage < TOTAL_PAGES) {
            currentPage++;
            displayCurrentPage();
            updateStats();
        }
    });

    // Aller à la première page
    const firstPageBtn = document.getElementById('first-page');
    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
            currentPage = 1;
            displayCurrentPage();
            updateStats();
        });
    }

    // Aller à une page précise
    const gotoInput = document.getElementById('goto-page-input');
    const gotoBtn = document.getElementById('goto-page-btn');
    if (gotoBtn && gotoInput) {
        gotoBtn.addEventListener('click', () => {
            const page = parseInt(gotoInput.value, 10);
            if (!isNaN(page) && page >= 1 && page <= TOTAL_PAGES) {
                currentPage = page;
                displayCurrentPage();
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
    
    // Event listeners pour le dropdown des filtres
    setupFilterDropdown();
}

// Configurer le dropdown des filtres
function setupFilterDropdown() {
    const filterDropdownBtn = document.getElementById('filter-dropdown-btn');
    const filterDropdownMenu = document.getElementById('filter-dropdown-menu');
    const filterOptions = document.querySelectorAll('.filter-option');
    
    // Ouvrir/fermer le dropdown
    filterDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterDropdownMenu.classList.toggle('show');
        filterDropdownBtn.classList.toggle('active');
    });
    
    // Fermer le dropdown en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!filterDropdownBtn.contains(e.target) && !filterDropdownMenu.contains(e.target)) {
            filterDropdownMenu.classList.remove('show');
            filterDropdownBtn.classList.remove('active');
        }
    });
    
    // Gérer la sélection des filtres
    filterOptions.forEach(option => {
        option.addEventListener('click', () => {
            const filter = option.dataset.filter;
            setFilter(filter);
            
            // Mettre à jour l'affichage du dropdown
            updateFilterDropdownDisplay(filter);
            
            // Fermer le dropdown
            filterDropdownMenu.classList.remove('show');
            filterDropdownBtn.classList.remove('active');
        });
    });
}

// Mettre à jour l'affichage du dropdown
function updateFilterDropdownDisplay(filter) {
    const filterDropdownText = document.getElementById('filter-dropdown-text');
    const filterOptions = document.querySelectorAll('.filter-option');
    
    // Retirer la sélection précédente
    filterOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    // Mettre à jour le texte du bouton et sélectionner l'option
    switch (filter) {
        case 'all':
            filterDropdownText.textContent = 'Tous les Pokémon';
            filterOptions[0].classList.add('selected');
            break;
        case 'captured':
            filterDropdownText.textContent = 'Pokémon capturés';
            filterOptions[1].classList.add('selected');
            break;
        case 'missing':
            filterDropdownText.textContent = 'Pokémon manquants';
            filterOptions[2].classList.add('selected');
            break;
    }
}

// Afficher la page courante
function displayCurrentPage() {
    // Si filtre capturé, afficher tous les capturés sur une seule page
    if (currentFilter === 'captured') {
        currentPageElement.textContent = 1;
        pokemonGrid.innerHTML = '';
        const capturedList = Array.from(capturedPokemon).sort((a, b) => a - b);
        capturedList.forEach(pokemonNumber => {
            const pokemonName = pokemonList[pokemonNumber - 1];
            const card = createPokemonCard(pokemonNumber, pokemonName, true);
            // Afficher la page d'origine
            const page = Math.ceil(pokemonNumber / POKEMON_PER_PAGE);
            const nameElem = card.querySelector('.pokemon-name');
            if (nameElem) {
                const pageInfo = document.createElement('div');
                pageInfo.className = 'pokemon-page-info';
                pageInfo.textContent = `Page ${page}`;
                nameElem.after(pageInfo);
            }
            pokemonGrid.appendChild(card);
        });
        updateNavigationButtons(true); // désactive les boutons
        return;
    }
    // Sinon, comportement normal
    currentPageElement.textContent = currentPage;
    const startIndex = (currentPage - 1) * POKEMON_PER_PAGE;
    const endIndex = Math.min(startIndex + POKEMON_PER_PAGE, TOTAL_POKEMON);
    pokemonGrid.innerHTML = '';
    for (let i = startIndex; i < endIndex; i++) {
        const pokemonNumber = i + 1;
        const pokemonName = pokemonList[i];
        const isCaptured = capturedPokemon.has(pokemonNumber);
        const pokemonCard = createPokemonCard(pokemonNumber, pokemonName, isCaptured);
        pokemonGrid.appendChild(pokemonCard);
    }
    applyCurrentFilter();
    updateNavigationButtons();
}

// Créer une carte Pokémon
function createPokemonCard(number, name, isCaptured) {
    const card = document.createElement('div');
    card.className = `pokemon-card ${isCaptured ? 'captured' : ''}`;
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
                    : 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.4) 100%)'
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
                        : 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.4) 100%)'
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
        capturedPokemon.delete(pokemonNumber);
        console.log(`[CAPTURE] Pokémon #${pokemonNumber} relâché`);
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

// Mettre à jour une carte Pokémon spécifique sans recharger les images
function updatePokemonCard(pokemonNumber) {
    const card = document.querySelector(`[data-pokemon-number="${pokemonNumber}"]`);
    if (card) {
        const isCaptured = capturedPokemon.has(pokemonNumber);
        
        // Mettre à jour la classe CSS
        card.classList.toggle('captured', isCaptured);
        
        // Mettre à jour l'overlay si il existe
        const overlay = card.querySelector('.card-overlay');
        if (overlay) {
            if (isCaptured) {
                overlay.style.background = 'linear-gradient(135deg, rgba(78, 205, 196, 0.3) 0%, rgba(68, 160, 141, 0.1) 50%, rgba(78, 205, 196, 0.4) 100%)';
            } else {
                overlay.style.background = 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.4) 100%)';
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
        case ' ':
            event.preventDefault();
            // Basculer la capture du Pokémon au centre de l'écran
            const centerCard = document.querySelector('.pokemon-card:nth-child(8)');
            if (centerCard) {
                centerCard.click();
            }
            break;
    }
});

// Démarrer l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM chargé, initialisation de l\'application...');
    init();
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
function setFilter(filter) {
    currentFilter = filter;
    // Mettre à jour l'affichage du dropdown
    updateFilterDropdownDisplay(filter);
    displayCurrentPage();
    updateStats();
    // Sauvegarder la préférence de filtre
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
            case 'missing':
                if (isCaptured) {
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
    
    // Afficher le bouton de suppression si il y a du texte
    clearSearchBtn.style.display = query.length > 0 ? 'flex' : 'none';
    
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
    const results = pokemonList
        .map((name, index) => ({
            number: index + 1,
            name: name,
            isCaptured: capturedPokemon.has(index + 1)
        }))
        .filter(pokemon => 
            pokemon.name.toLowerCase().includes(searchTerm) ||
            pokemon.number.toString().includes(searchTerm)
        )
        .slice(0, 8); // Limiter à 8 résultats
    
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
}

function hideSearchResults() {
    searchResults.style.display = 'none';
    selectedResultIndex = -1;
}

function clearSearch() {
    searchInput.value = '';
    hideSearchResults();
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
}

function handleSearch() {
    const query = searchInput.value.trim();
    if (query.length > 0) {
        performSearch(query);
    }
}

function goToPokemon(pokemonNumber) {
    console.log(`[SEARCH] Navigation vers le Pokémon #${pokemonNumber}`);
    
    // Forcer le filtre sur "Tous" pour que la carte soit visible
    setFilter('all');
    
    // Calculer la page contenant ce Pokémon
    const targetPage = Math.ceil(pokemonNumber / POKEMON_PER_PAGE);
    
    console.log(`[SEARCH] Pokémon #${pokemonNumber} se trouve à la page ${targetPage} (${POKEMON_PER_PAGE} Pokémon par page)`);
    
    // Aller à la page si nécessaire
    if (currentPage !== targetPage) {
        currentPage = targetPage;
        displayCurrentPage();
        updateNavigationButtons();
    }
    
    // Mettre à jour les statistiques
    updateStats();
    
    // Attendre que la carte soit bien présente dans le DOM puis la mettre en surbrillance
    setTimeout(() => {
        const pokemonCard = document.querySelector(`[data-pokemon-number="${pokemonNumber}"]`);
        if (pokemonCard) {
            console.log(`[SEARCH] Carte trouvée, mise en surbrillance`);
            
            // Animation de surbrillance
            pokemonCard.style.animation = 'capturedPulse 1.5s ease';
            setTimeout(() => {
                pokemonCard.style.animation = '';
            }, 1500);
            
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

// Afficher un message de bienvenue
window.addEventListener('load', () => {
    setTimeout(() => {
        showNotification('Bienvenue dans le Pokédex Challenge ! 🎮', 'info');
    }, 1000);
});

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
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    
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
    
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', toggleDarkMode);
    }
    
    // Event listeners pour les fonctionnalités admin
    setupAdminEventListeners();
}

function loadSettings() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const maintenanceModeToggle = document.getElementById('maintenance-mode');
    
    if (darkModeToggle) {
        isDarkMode = localStorage.getItem('darkMode') === 'true';
        darkModeToggle.checked = isDarkMode;
        applyDarkMode();
    }
    
    if (maintenanceModeToggle) {
        const isMaintenance = localStorage.getItem('maintenanceMode') === 'true';
        maintenanceModeToggle.checked = isMaintenance;
    }
}

// Basculer le mode sombre
function toggleDarkMode() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        isDarkMode = darkModeToggle.checked;
        localStorage.setItem('darkMode', isDarkMode);
        applyDarkMode();
        showNotification(`Mode sombre ${isDarkMode ? 'activé' : 'désactivé'}`, 'info');
    }
}

// Appliquer le mode sombre
function applyDarkMode() {
    const body = document.body;
    if (isDarkMode) {
        body.classList.add('dark-mode');
    } else {
        body.classList.remove('dark-mode');
    }
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
    
    // Mode maintenance
    const maintenanceModeToggle = document.getElementById('maintenance-mode');
    if (maintenanceModeToggle) {
        maintenanceModeToggle.addEventListener('change', toggleMaintenanceMode);
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
    const usersContent = document.getElementById('users-content');
    
    usersContent.innerHTML = '<p>Chargement des utilisateurs...</p>';
    usersModal.style.display = 'flex';
    
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const usersSnapshot = await getDocs(collection(window.db, 'users'));
        
        let usersTable = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Utilisateur</th>
                        <th>Email</th>
                        <th>Rôle</th>
                        <th>Pokémon capturés</th>
                        <th>Complétion</th>
                        <th>Dernière activité</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const capturedCount = userData.capturedPokemon ? userData.capturedPokemon.length : 0;
            const completion = ((capturedCount / TOTAL_POKEMON) * 100).toFixed(1);
            const lastActivity = userData.lastSaved ? new Date(userData.lastSaved.toDate()).toLocaleDateString('fr-FR') : 'Jamais';
            const currentRole = userData.role || 'member';
            
            usersTable += `
                <tr data-uid="${doc.id}">
                    <td>${userData.username || 'N/A'}</td>
                    <td>${userData.email || 'N/A'}</td>
                    <td>
                        <span class="role-badge ${currentRole}">${currentRole}</span>
                        <div class="role-selector-inline">
                            <select class="role-select" data-uid="${doc.id}" data-current-role="${currentRole}">
                                <option value="member" ${currentRole === 'member' ? 'selected' : ''}>Membre</option>
                                <option value="tester" ${currentRole === 'tester' ? 'selected' : ''}>Testeur</option>
                                <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                            <button class="update-role-btn" data-uid="${doc.id}" style="display: none;">✓</button>
                        </div>
                    </td>
                    <td>${capturedCount}</td>
                    <td>${completion}%</td>
                    <td>${lastActivity}</td>
                    <td>
                        <button class="admin-btn danger small" onclick="resetUserProgressById('${doc.id}')" title="Réinitialiser progression">
                            🔄
                        </button>
                    </td>
                </tr>
            `;
        });
        
        usersTable += '</tbody></table>';
        usersContent.innerHTML = usersTable;
        
        // Ajouter les event listeners pour les sélecteurs de rôle
        setupRoleSelectors();
        
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        usersContent.innerHTML = '<p>Erreur lors du chargement des utilisateurs</p>';
    }
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

// Basculer le mode maintenance
async function toggleMaintenanceMode() {
    if (!hasPermission('manage_users')) {
        showNotification('Accès refusé', 'error');
        return;
    }
    
    const maintenanceModeToggle = document.getElementById('maintenance-mode');
    const isMaintenance = maintenanceModeToggle.checked;
    
    try {
        // Sauvegarder l'état de maintenance dans Firestore pour tous les utilisateurs
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        await setDoc(doc(window.db, 'app', 'maintenance'), {
            isMaintenance: isMaintenance,
            updatedBy: currentUser.uid,
            updatedAt: new Date()
        });
        
        localStorage.setItem('maintenanceMode', isMaintenance);
        showNotification(`Mode maintenance ${isMaintenance ? 'activé' : 'désactivé'}`, 'info');
        
        // Si on désactive le mode maintenance, recharger la page pour tous
        if (!isMaintenance) {
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }
    } catch (error) {
        console.error('Erreur lors du changement de mode maintenance:', error);
        showNotification('Erreur lors du changement de mode maintenance', 'error');
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

// Vérifier le mode maintenance
async function checkMaintenanceMode() {
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        const maintenanceDoc = await getDoc(doc(window.db, 'app', 'maintenance'));
        
        if (maintenanceDoc.exists()) {
            const maintenanceData = maintenanceDoc.data();
            if (maintenanceData.isMaintenance && userRole !== 'admin') {
                // Bloquer l'accès pour les non-admins
                showMaintenanceScreen();
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error('Erreur lors de la vérification du mode maintenance:', error);
        return true; // En cas d'erreur, on laisse passer
    }
}

// Afficher l'écran de maintenance
function showMaintenanceScreen() {
    // Masquer l'app et l'auth
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('auth-container').style.display = 'none';
    
    // Créer l'écran de maintenance
    const maintenanceScreen = document.createElement('div');
    maintenanceScreen.id = 'maintenance-screen';
    maintenanceScreen.innerHTML = `
        <div class="maintenance-container">
            <div class="maintenance-content">
                <h1>🔧 Maintenance en cours</h1>
                <p>L'application est actuellement en maintenance.</p>
                <p>Nous serons de retour bientôt !</p>
                <div class="maintenance-info">
                    <p>🕐 Dernière mise à jour : ${new Date().toLocaleString('fr-FR')}</p>
                </div>
                <button onclick="window.location.reload()" class="maintenance-btn">
                    🔄 Actualiser
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(maintenanceScreen);
}

// Configurer les sélecteurs de rôle
function setupRoleSelectors() {
    const roleSelects = document.querySelectorAll('.role-select');
    
    roleSelects.forEach(select => {
        select.addEventListener('change', function() {
            const uid = this.dataset.uid;
            const newRole = this.value;
            const currentRole = this.dataset.currentRole;
            const updateBtn = document.querySelector(`.update-role-btn[data-uid="${uid}"]`);
            
            if (newRole !== currentRole) {
                updateBtn.style.display = 'inline-block';
            } else {
                updateBtn.style.display = 'none';
            }
        });
    });
    
    // Event listeners pour les boutons de mise à jour
    const updateBtns = document.querySelectorAll('.update-role-btn');
    updateBtns.forEach(btn => {
        btn.addEventListener('click', async function() {
            const uid = this.dataset.uid;
            const select = document.querySelector(`.role-select[data-uid="${uid}"]`);
            const newRole = select.value;
            
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
        
        // Mettre à jour l'affichage
        const select = document.querySelector(`.role-select[data-uid="${uid}"]`);
        const badge = select.closest('td').querySelector('.role-badge');
        const updateBtn = document.querySelector(`.update-role-btn[data-uid="${uid}"]`);
        
        select.dataset.currentRole = newRole;
        badge.textContent = newRole;
        badge.className = `role-badge ${newRole}`;
        updateBtn.style.display = 'none';
        
        showNotification(`Rôle mis à jour : ${newRole}`, 'success');
    } catch (error) {
        console.error('Erreur lors de la mise à jour du rôle:', error);
        showNotification('Erreur lors de la mise à jour du rôle', 'error');
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
function updateGridSize() {
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
    displayCurrentPage();
    updateStats();
    
    // Mettre à jour le texte de pagination
    const pageInfo = document.querySelector('.page-info');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} / ${TOTAL_PAGES}`;
    }
    
    showNotification(`Grille mise à jour : ${newSize} Pokémon par page`, 'success');
}

// Rendre les fonctions disponibles globalement
window.changeUserRole = changeUserRole;
window.resetUserProgressById = resetUserProgressById; 