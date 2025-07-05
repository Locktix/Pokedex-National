#!/usr/bin/env python3
"""
Serveur HTTP simple pour le Pokédex Challenge
Lancez ce script et ouvrez http://localhost:8000 dans votre navigateur
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

# Configuration
PORT = 8000
DIRECTORY = Path(__file__).parent

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Ajouter les en-têtes CORS pour permettre les requêtes
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        # Gérer les requêtes OPTIONS pour CORS
        self.send_response(200)
        self.end_headers()

def main():
    # Changer vers le répertoire du script
    os.chdir(DIRECTORY)
    
    # Créer le serveur
    with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
        print(f"🚀 Serveur démarré sur http://localhost:{PORT}")
        print(f"📁 Répertoire: {DIRECTORY}")
        print("🌐 Ouvrez votre navigateur et allez sur l'URL ci-dessus")
        print("⏹️  Appuyez sur Ctrl+C pour arrêter le serveur")
        print("-" * 50)
        
        # Ouvrir automatiquement le navigateur
        try:
            webbrowser.open(f'http://localhost:{PORT}')
        except:
            pass
        
        # Démarrer le serveur
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Serveur arrêté")

if __name__ == "__main__":
    main() 