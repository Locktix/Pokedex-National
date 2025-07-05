# 🎮 Pokédex Challenge

Une application web interactive pour capturer et collectionner tous les Pokémon de la génération 1 à 9 (1025 Pokémon au total).

## ✨ Fonctionnalités

- **Collection complète** : 1025 Pokémon de la génération 1 à 9
- **Interface moderne** : Design responsive et animations fluides
- **Recherche avancée** : Recherche en temps réel avec navigation clavier
- **Filtres intelligents** : Afficher tous, capturés ou manquants
- **Pagination** : Navigation facile entre les pages
- **Sauvegarde cloud** : Synchronisation Firebase pour sauvegarder votre progression
- **Système de rôles** : Gestion des permissions utilisateur
- **Mode sombre** : Interface adaptée pour les yeux

## 👥 Système de rôles

L'application dispose d'un système de rôles avec trois niveaux d'accès :

### 🔵 Membre (Rôle par défaut)
- **Permissions** : Voir les Pokémon, capturer des Pokémon
- **Fonctionnalités** : Accès complet à la collection et aux fonctionnalités de base

### 🟠 Testeur
- **Permissions** : Toutes les permissions Membre + test des nouvelles fonctionnalités
- **Fonctionnalités** : Accès aux fonctionnalités expérimentales et de test

### 🔴 Administrateur
- **Permissions** : Toutes les permissions Testeur + gestion des utilisateurs et des rôles
- **Fonctionnalités** :
  - Gestion complète des utilisateurs
  - Modification des rôles des autres utilisateurs
  - Accès aux paramètres avancés
  - Statistiques d'utilisation

### Gestion des rôles
- Seuls les administrateurs peuvent modifier les rôles des utilisateurs
- Un utilisateur ne peut pas modifier son propre rôle
- Les nouveaux utilisateurs reçoivent automatiquement le rôle "Membre"

## 🚀 Installation

1. Clonez le repository
2. Ouvrez `index.html` dans votre navigateur
3. Créez un compte ou connectez-vous
4. Commencez votre collection !

## 🛠️ Technologies utilisées

- **Frontend** : HTML5, CSS3, JavaScript vanilla
- **Backend** : Firebase (Authentication, Firestore)
- **API** : PokéAPI pour les données des Pokémon
- **Design** : CSS Grid, Flexbox, Animations CSS

## 📱 Compatibilité

- Navigateurs modernes (Chrome, Firefox, Safari, Edge)
- Responsive design pour mobile et desktop
- Fonctionne hors ligne (avec cache)

## 🎯 Objectif

Capturer tous les 1025 Pokémon pour compléter votre Pokédex ! Chaque Pokémon capturé est sauvegardé dans votre compte et synchronisé sur tous vos appareils.

---

*Développé avec ❤️ par Locktix*

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

## 🎉 Bonne chance !

Que la chance soit avec vous dans votre quête pour compléter votre Pokédex ! 🎮✨

---

## 📄 Licence et crédits

Ce projet est créé à des fins éducatives et de divertissement. Tous les noms de Pokémon sont la propriété de Nintendo/Game Freak/The Pokémon Company.

**Développé avec ❤️ par Locktix.**

*Dernière mise à jour : 2025* 