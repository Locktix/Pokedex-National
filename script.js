// Configuration
const TOTAL_POKEMON = 1025;
const POKEMON_PER_PAGE = 16; // 4x4 grille
const TOTAL_PAGES = Math.ceil(TOTAL_POKEMON / POKEMON_PER_PAGE);

// Variables globales
let currentPage = 1;
let capturedPokemon = new Set();
let pokemonList = [];
let currentFilter = 'all'; // 'all', 'captured', 'missing'
let currentUser = null;

// Éléments DOM
const pokemonGrid = document.getElementById('pokemon-grid');
const currentPageElement = document.getElementById('current-page');
const capturedCountElement = document.getElementById('captured-count');
const percentageElement = document.getElementById('percentage');
const remainingElement = document.getElementById('remaining');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearSearchBtn = document.getElementById('clear-search');
const searchResults = document.getElementById('search-results');
const showAllBtn = document.getElementById('show-all');
const showCapturedBtn = document.getElementById('show-captured');
const showMissingBtn = document.getElementById('show-missing');

// Initialisation
async function init() {
    try {
        const response = await fetch('listes.json');
        pokemonList = await response.json();
        
        // Initialiser l'authentification Firebase
        initAuth();
        
        console.log(`Application initialisée avec ${pokemonList.length} Pokémon`);
    } catch (error) {
        console.error('Erreur lors du chargement des Pokémon:', error);
        pokemonGrid.innerHTML = '<p style="text-align: center; color: red;">Erreur lors du chargement des données</p>';
    }
}

// Initialiser l'authentification Firebase
function initAuth() {
    // Écouter les changements d'état d'authentification
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Utilisateur connecté
            currentUser = user;
            showApp();
            await loadUserData();
            setupEventListeners();
            displayCurrentPage();
            updateStats();
            setFilter(currentFilter);
        } else {
            // Utilisateur déconnecté
            currentUser = null;
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
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('user-email').textContent = currentUser.email;
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
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Connexion réussie ! 🎉', 'success');
    } catch (error) {
        console.error('Erreur de connexion:', error);
        showNotification('Erreur de connexion: ' + error.message, 'error');
    }
}

// Gérer l'inscription
async function handleRegister() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Créer le profil utilisateur dans Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            username: username,
            email: email,
            createdAt: new Date(),
            capturedPokemon: []
        });
        showNotification('Compte créé avec succès ! 🎉', 'success');
    } catch (error) {
        console.error('Erreur d\'inscription:', error);
        showNotification('Erreur d\'inscription: ' + error.message, 'error');
    }
}

// Gérer la déconnexion
async function handleLogout() {
    try {
        await signOut(auth);
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
    
    // Event listeners pour la recherche
    searchInput.addEventListener('input', handleSearch);
    searchBtn.addEventListener('click', () => handleSearch());
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Fermer les résultats de recherche en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            hideSearchResults();
        }
    });
    
    // Recherche avec Entrée
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    });
    
    // Event listeners pour les filtres
    showAllBtn.addEventListener('click', () => setFilter('all'));
    showCapturedBtn.addEventListener('click', () => setFilter('captured'));
    showMissingBtn.addEventListener('click', () => setFilter('missing'));
}

// Afficher la page courante
function displayCurrentPage() {
    currentPageElement.textContent = currentPage;
    
    // Calculer les indices de début et fin pour cette page
    const startIndex = (currentPage - 1) * POKEMON_PER_PAGE;
    const endIndex = Math.min(startIndex + POKEMON_PER_PAGE, TOTAL_POKEMON);
    
    // Vider la grille
    pokemonGrid.innerHTML = '';
    
    // Créer les cartes Pokémon pour cette page
    for (let i = startIndex; i < endIndex; i++) {
        const pokemonNumber = i + 1;
        const pokemonName = pokemonList[i];
        const isCaptured = capturedPokemon.has(pokemonNumber);
        
        const pokemonCard = createPokemonCard(pokemonNumber, pokemonName, isCaptured);
        pokemonGrid.appendChild(pokemonCard);
    }
    
    // Appliquer le filtre actuel
    applyCurrentFilter();
    
    // Mettre à jour l'état des boutons de navigation
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
            
            // Créer un overlay si il n'existe pas déjà
            if (!card.querySelector('.card-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'card-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.4) 100%);
                    pointer-events: none;
                    z-index: 1;
                `;
                card.appendChild(overlay);
            }
            
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
        };
        
        // Démarrer le chargement
        img.src = imageUrl;
        
    } catch (error) {
        console.error(`Erreur lors du chargement de l'image pour le Pokémon #${pokemonNumber}:`, error);
        card.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
}

// Basculer la capture d'un Pokémon
function togglePokemonCapture(pokemonNumber) {
    if (capturedPokemon.has(pokemonNumber)) {
        capturedPokemon.delete(pokemonNumber);
    } else {
        capturedPokemon.add(pokemonNumber);
    }
    
    // Mettre à jour seulement la carte concernée
    updatePokemonCard(pokemonNumber);
    updateStats();
    
    // Sauvegarder les données utilisateur
    saveUserData();
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
function updateNavigationButtons() {
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= TOTAL_PAGES;
    
    // Ajouter des styles visuels pour les boutons désactivés
    if (prevPageBtn.disabled) {
        prevPageBtn.style.opacity = '0.5';
        prevPageBtn.style.cursor = 'not-allowed';
    } else {
        prevPageBtn.style.opacity = '1';
        prevPageBtn.style.cursor = 'pointer';
    }
    
    if (nextPageBtn.disabled) {
        nextPageBtn.style.opacity = '0.5';
        nextPageBtn.style.cursor = 'not-allowed';
    } else {
        nextPageBtn.style.opacity = '1';
        nextPageBtn.style.cursor = 'pointer';
    }
}

// Charger les données utilisateur depuis Firebase
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            capturedPokemon = new Set(userData.capturedPokemon || []);
            currentFilter = userData.currentFilter || 'all';
            console.log(`Données utilisateur chargées: ${capturedPokemon.size} Pokémon capturés`);
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

// Sauvegarder les données utilisateur dans Firebase
async function saveUserData() {
    if (!currentUser) return;
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            capturedPokemon: Array.from(capturedPokemon),
            currentFilter: currentFilter,
            lastSaved: new Date()
        });
        console.log('Données utilisateur sauvegardées dans Firebase');
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
document.addEventListener('DOMContentLoaded', init);

// Sauvegarder automatiquement toutes les 30 secondes
setInterval(saveUserData, 30000);

// Fonctions de filtrage
function setFilter(filter) {
    currentFilter = filter;
    
    // Mettre à jour l'état actif des boutons
    showAllBtn.classList.toggle('active', filter === 'all');
    showCapturedBtn.classList.toggle('active', filter === 'captured');
    showMissingBtn.classList.toggle('active', filter === 'missing');
    
    // Appliquer le filtre
    applyCurrentFilter();
    
    // Mettre à jour les statistiques selon le filtre
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

// Fonctions de recherche
function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    
    if (query.length === 0) {
        clearSearch();
        return;
    }
    
    const results = pokemonList
        .map((name, index) => ({
            number: index + 1,
            name: name,
            isCaptured: capturedPokemon.has(index + 1)
        }))
        .filter(pokemon => 
            pokemon.name.toLowerCase().includes(query) ||
            pokemon.number.toString().includes(query)
        )
        .slice(0, 10); // Limiter à 10 résultats
    
    displaySearchResults(results);
}

function displaySearchResults(results) {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">Aucun Pokémon trouvé</div>';
        showSearchResults();
        return;
    }
    
    searchResults.innerHTML = results.map(pokemon => `
        <div class="search-result-item" onclick="goToPokemon(${pokemon.number})" data-pokemon-number="${pokemon.number}">
            <div class="search-result-image"></div>
            <div class="search-result-content">
                <div class="search-result-number">#${pokemon.number.toString().padStart(3, '0')}</div>
                <div class="search-result-name">${pokemon.name}</div>
                ${pokemon.isCaptured ? '<div class="search-result-captured">✓</div>' : ''}
            </div>
        </div>
    `).join('');
    
    // Charger les images pour les résultats de recherche
    results.forEach(pokemon => {
        const resultItem = searchResults.querySelector(`[data-pokemon-number="${pokemon.number}"]`);
        if (resultItem) {
            loadSearchResultImage(resultItem, pokemon.number);
        }
    });
    
    showSearchResults();
}

// Charger l'image pour un résultat de recherche
async function loadSearchResultImage(resultItem, pokemonNumber) {
    try {
        const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonNumber}.png`;
        const imageElement = resultItem.querySelector('.search-result-image');
        
        const img = new Image();
        
        img.onload = () => {
            imageElement.style.backgroundImage = `url(${imageUrl})`;
            imageElement.style.backgroundSize = 'cover';
            imageElement.style.backgroundPosition = 'center';
            imageElement.style.backgroundRepeat = 'no-repeat';
        };
        
        img.onerror = () => {
            console.warn(`Impossible de charger l'image pour le Pokémon #${pokemonNumber} dans la recherche`);
            imageElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        };
        
        img.src = imageUrl;
        
    } catch (error) {
        console.error(`Erreur lors du chargement de l'image de recherche pour le Pokémon #${pokemonNumber}:`, error);
    }
}

function showSearchResults() {
    searchResults.style.display = 'block';
    clearSearchBtn.style.display = 'flex';
}

function hideSearchResults() {
    searchResults.style.display = 'none';
}

function clearSearch() {
    searchInput.value = '';
    hideSearchResults();
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
}

function goToPokemon(pokemonNumber) {
    // Calculer la page où se trouve ce Pokémon
    const targetPage = Math.ceil(pokemonNumber / POKEMON_PER_PAGE);
    
    // Aller à la page
    currentPage = targetPage;
    displayCurrentPage();
    updateStats();
    
    // Fermer la recherche
    clearSearch();
    
    // Mettre en surbrillance le Pokémon (optionnel)
    setTimeout(() => {
        const pokemonCard = document.querySelector(`[data-pokemon-number="${pokemonNumber}"]`);
        if (pokemonCard) {
            pokemonCard.style.animation = 'capturedPulse 1s ease';
            setTimeout(() => {
                pokemonCard.style.animation = '';
            }, 1000);
        }
    }, 100);
}

// Afficher un message de bienvenue
window.addEventListener('load', () => {
    setTimeout(() => {
        showNotification('Bienvenue dans le Pokédex Challenge ! 🎮', 'info');
    }, 1000);
}); 