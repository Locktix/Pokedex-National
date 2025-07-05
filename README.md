# 🎮 Pokédex Challenge

Un site web interactif pour suivre votre progression dans le challenge de collectionner les 1025 Pokémon dans un classeur 4x4 (32 pages).

## 📋 Fonctionnalités

- **Grille 4x4** : Affichage de 16 Pokémon par page (32 pages au total)
- **Navigation intuitive** : Boutons pour naviguer entre les pages
- **Capture/Relâche** : Cliquez sur un Pokémon pour le marquer comme capturé
- **Statistiques en temps réel** : Suivi du nombre de Pokémon capturés, pourcentage de complétion
- **Sauvegarde automatique** : Vos données sont sauvegardées localement dans votre navigateur
- **Design responsive** : Fonctionne sur mobile, tablette et desktop
- **Raccourcis clavier** : Navigation avec les flèches, capture avec la barre d'espace

## 🚀 Installation et démarrage

### Option 1 : Avec serveur local (Recommandée)

1. **Installer Python** (si pas déjà fait) : [python.org](https://python.org)
2. **Lancer le serveur** :
   ```bash
   python server.py
   ```
3. **Ouvrir le navigateur** : Le site s'ouvrira automatiquement sur `http://localhost:8000`

### Option 2 : Sans serveur

⚠️ **Note** : Cette méthode peut causer des erreurs CORS dans certains navigateurs.

1. Double-cliquez sur `index.html`
2. Si vous avez des erreurs, utilisez l'option 1 avec le serveur

## 🎯 Comment utiliser

1. **Naviguer** : Utilisez les boutons "Précédent" et "Suivant" pour parcourir les pages
2. **Capturer** : Cliquez sur un Pokémon pour le marquer comme capturé (✓ vert)
3. **Suivre votre progression** : Regardez les statistiques en haut de la page
4. **Réinitialiser** : Utilisez le bouton "Réinitialiser" si vous voulez recommencer

## ⌨️ Raccourcis clavier

- **Flèche gauche** : Page précédente
- **Flèche droite** : Page suivante
- **Barre d'espace** : Capturer/relâcher le Pokémon au centre de l'écran

## 💾 Sauvegarde

Vos données sont automatiquement sauvegardées dans le localStorage de votre navigateur. Cela signifie que :
- Vos progrès sont conservés même si vous fermez le navigateur
- Les données sont locales à votre appareil
- Vous pouvez reprendre où vous en étiez à tout moment

## 📱 Compatibilité

- ✅ Chrome, Firefox, Safari, Edge
- ✅ Mobile (iOS, Android)
- ✅ Tablette
- ✅ Desktop

## 🎯 Le Challenge

Le Pokédex Challenge consiste à collectionner les 1025 Pokémon disponibles dans les jeux Pokémon. Avec un classeur de 4x4 par page :
- **32 pages** au total
- **16 Pokémon** par page
- **1024 emplacements** + 1 Pokémon supplémentaire = **1025 Pokémon**

## 📁 Structure des fichiers

```
Pokédex-Challenge/
├── index.html          # Page principale
├── styles.css          # Styles CSS
├── script.js           # Logique JavaScript
├── listes.json         # Liste des 1025 Pokémon
├── server.py           # Serveur local Python
└── README.md           # Ce fichier
```

## 🔧 Personnalisation

Vous pouvez facilement personnaliser l'application en modifiant :
- Les couleurs dans `styles.css`
- Les animations et effets visuels
- Le nombre de Pokémon par page (actuellement 16)
- Les raccourcis clavier dans `script.js`

## 🎨 Design

L'application utilise un design moderne avec :
- Dégradés de couleurs
- Animations fluides
- Interface intuitive
- Design responsive
- Thème Pokémon avec des couleurs vives

## 📊 Statistiques

L'application affiche en temps réel :
- **Nombre de Pokémon capturés**
- **Pourcentage de complétion**
- **Nombre de Pokémon restants**

## 🛠️ Développement

### Technologies utilisées
- **HTML5** : Structure de la page
- **CSS3** : Styles et animations
- **JavaScript ES6+** : Logique de l'application
- **Python** : Serveur local (optionnel)

### Fonctionnalités techniques
- **localStorage** : Sauvegarde des données
- **Fetch API** : Chargement des données JSON
- **CSS Grid** : Layout responsive
- **Event Listeners** : Interactions utilisateur

## 🎉 Bonne chance !

Que la chance soit avec vous dans votre quête pour compléter votre Pokédex ! 🎮✨

---

## 📄 Licence et crédits

Ce projet est créé à des fins éducatives et de divertissement. Tous les noms de Pokémon sont la propriété de Nintendo/Game Freak/The Pokémon Company.

**Développé avec ❤️ par Alan B.**

*Dernière mise à jour : 2024* 