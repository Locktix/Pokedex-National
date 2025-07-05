// Configuration
const TOTAL_POKEMON = 1025;
const POKEMON_PER_PAGE = 16; // 4x4 grille
const TOTAL_PAGES = Math.ceil(TOTAL_POKEMON / POKEMON_PER_PAGE);

// Variables globales
let currentPage = 1;
let capturedPokemon = new Set();
let pokemonList = [];

// Éléments DOM
const pokemonGrid = document.getElementById('pokemon-grid');
const currentPageElement = document.getElementById('current-page');
const capturedCountElement = document.getElementById('captured-count');
const percentageElement = document.getElementById('percentage');
const remainingElement = document.getElementById('remaining');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const resetBtn = document.getElementById('reset-collection');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearSearchBtn = document.getElementById('clear-search');
const searchResults = document.getElementById('search-results');

// Initialisation
async function init() {
    try {
        const response = await fetch('listes.json');
        pokemonList = await response.json();
        
        // Charger les données sauvegardées
        loadSavedData();
        
        // Afficher la première page
        displayCurrentPage();
        updateStats();
        
        // Ajouter les event listeners
        setupEventListeners();
        
        console.log(`Application initialisée avec ${pokemonList.length} Pokémon`);
    } catch (error) {
        console.error('Erreur lors du chargement des Pokémon:', error);
        pokemonGrid.innerHTML = '<p style="text-align: center; color: red;">Erreur lors du chargement des données</p>';
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
    
    resetBtn.addEventListener('click', () => {
        if (confirm('Êtes-vous sûr de vouloir réinitialiser votre collection ? Cette action ne peut pas être annulée.')) {
            resetCollection();
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
    
    return card;
}

// Basculer la capture d'un Pokémon
function togglePokemonCapture(pokemonNumber) {
    if (capturedPokemon.has(pokemonNumber)) {
        capturedPokemon.delete(pokemonNumber);
    } else {
        capturedPokemon.add(pokemonNumber);
    }
    
    // Mettre à jour l'affichage
    displayCurrentPage();
    updateStats();
    
    // Sauvegarder les données
    saveData();
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

// Sauvegarder les données dans le localStorage
function saveData() {
    const data = {
        capturedPokemon: Array.from(capturedPokemon),
        lastSaved: new Date().toISOString()
    };
    
    try {
        localStorage.setItem('pokemonChallenge', JSON.stringify(data));
        console.log('Données sauvegardées');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
    }
}

// Charger les données sauvegardées
function loadSavedData() {
    try {
        const savedData = localStorage.getItem('pokemonChallenge');
        if (savedData) {
            const data = JSON.parse(savedData);
            capturedPokemon = new Set(data.capturedPokemon || []);
            console.log(`Données chargées: ${capturedPokemon.size} Pokémon capturés`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données sauvegardées:', error);
        capturedPokemon = new Set();
    }
}

// Réinitialiser la collection
function resetCollection() {
    capturedPokemon.clear();
    displayCurrentPage();
    updateStats();
    saveData();
    
    // Afficher une notification
    showNotification('Collection réinitialisée !', 'success');
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
setInterval(saveData, 30000);

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
        <div class="search-result-item" onclick="goToPokemon(${pokemon.number})">
            <div class="search-result-number">#${pokemon.number.toString().padStart(3, '0')}</div>
            <div class="search-result-name">${pokemon.name}</div>
            ${pokemon.isCaptured ? '<div class="search-result-captured">✓</div>' : ''}
        </div>
    `).join('');
    
    showSearchResults();
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