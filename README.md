# 🛍 MadaBoutique — Guide de déploiement complet

Application de vente en ligne avec paiement Mobile Money (MVola, Orange Money, Airtel Money)
et génération de factures PDF.

---

## 📁 Structure du projet

```
madaboutique/
├── backend/          ← API Node.js/Express
│   ├── server.js
│   ├── models/       ← Schémas MongoDB
│   ├── routes/       ← Endpoints API
│   ├── services/     ← MVola, Orange Money, Airtel, PDF
│   ├── middleware/   ← Authentification JWT
│   └── .env.example  ← Copier en .env
└── frontend/         ← Application React
    └── src/
        └── services/api.js  ← Appels API
```

---

## 🚀 ÉTAPES DE DÉPLOIEMENT

### ÉTAPE 1 — Base de données (MongoDB Atlas) [GRATUIT]

1. Créer un compte sur https://cloud.mongodb.com
2. Créer un **Cluster gratuit** (M0 Free Tier)
3. Créer un utilisateur DB : Security → Database Access
4. Autoriser toutes les IP : Security → Network Access → 0.0.0.0/0
5. Copier la **connection string** :
   ```
   mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/madaboutique
   ```

---

### ÉTAPE 2 — APIs Mobile Money

#### MVola (Telma)
1. S'inscrire sur https://developer.mvola.mg
2. Créer une application → obtenir `Consumer Key` et `Consumer Secret`
3. En production, contacter Telma pour activer le compte marchand
4. Renseigner dans `.env` :
   ```
   MVOLA_CONSUMER_KEY=xxxxx
   MVOLA_CONSUMER_SECRET=xxxxx
   MVOLA_MERCHANT_NUMBER=034XXXXXXX
   ```

#### Orange Money
1. S'inscrire sur https://developer.orange.com
2. Souscrire à l'API **Orange Money WebPay Madagascar**
3. Obtenir `Authorization` (Base64 de client_id:client_secret) et `Merchant Key`
4. Renseigner dans `.env` :
   ```
   ORANGE_MONEY_AUTHORIZATION=Basic xxxxx
   ORANGE_MONEY_MERCHANT_KEY=xxxxx
   ```

#### Airtel Money
1. S'inscrire sur https://developers.airtel.africa
2. Créer une application → Collections API
3. Renseigner dans `.env` :
   ```
   AIRTEL_MONEY_CLIENT_ID=xxxxx
   AIRTEL_MONEY_CLIENT_SECRET=xxxxx
   ```

---

### ÉTAPE 3 — Déployer le Backend sur Railway [RECOMMANDÉ]

**Railway.app** est le plus simple pour Madagascar (pas de carte bancaire requise).

```bash
# 1. Installer Railway CLI
npm install -g @railway/cli

# 2. Se connecter
railway login

# 3. Dans le dossier backend/
cd backend
npm install
railway init
railway up

# 4. Configurer les variables d'environnement
railway variables set MONGODB_URI="votre_uri"
railway variables set JWT_SECRET="votre_secret"
railway variables set MVOLA_CONSUMER_KEY="xxxxx"
# ... (toutes les variables du .env.example)
```

Votre API sera accessible sur : `https://madaboutique-backend.up.railway.app`

---

### ÉTAPE 4 — Déployer le Frontend sur Vercel [GRATUIT]

```bash
# 1. Installer Vercel CLI
npm install -g vercel

# 2. Dans le dossier frontend/
cd frontend
npm install

# 3. Créer le fichier .env.local
echo "REACT_APP_API_URL=https://madaboutique-backend.up.railway.app/api" > .env.local

# 4. Build et déployer
npm run build
vercel --prod
```

Votre app sera sur : `https://madaboutique.vercel.app`

---

### ÉTAPE 5 — Configurer les Webhooks (Callbacks)

Une fois déployé, configurer les URLs de callback dans chaque portail développeur :

| Provider     | URL Webhook |
|-------------|-------------|
| MVola        | `https://votre-api.railway.app/api/payments/mvola/callback` |
| Orange Money | `https://votre-api.railway.app/api/payments/orange/callback` |
| Airtel Money | `https://votre-api.railway.app/api/payments/airtel/callback` |

---

### ÉTAPE 6 — Domaine personnalisé (optionnel)

Pour utiliser `madaboutique.mg` :
1. Acheter le domaine chez **NIC-MG** (http://www.nic.mg) ou **Gasy Tech**
2. Dans Vercel : Settings → Domains → Ajouter `madaboutique.mg`
3. Configurer les DNS chez votre registrar :
   ```
   CNAME  www    cname.vercel-dns.com
   A      @      76.76.21.21
   ```

---

## 🔌 ENDPOINTS API COMPLETS

### Authentification
```
POST   /api/auth/register     Inscription
POST   /api/auth/login        Connexion
GET    /api/auth/me           Profil connecté
```

### Produits
```
GET    /api/products          Liste (filtres: category, search)
GET    /api/products/:id      Détail produit
POST   /api/products          Créer produit (admin)
```

### Commandes
```
POST   /api/orders            Créer une commande
GET    /api/orders            Mes commandes
GET    /api/orders/:id        Détail commande
```

### Paiements
```
POST   /api/payments/initiate          Initier paiement
GET    /api/payments/:txnId/status     Vérifier statut
POST   /api/payments/mvola/callback    Webhook MVola
POST   /api/payments/orange/callback   Webhook Orange Money
POST   /api/payments/airtel/callback   Webhook Airtel Money
```

### Factures
```
GET    /api/invoices/:orderId/download  Télécharger PDF
GET    /api/invoices/:orderId/preview   Aperçu HTML
```

---

## 🏗 Stack technique

| Composant  | Technologie |
|------------|-------------|
| Backend    | Node.js + Express |
| Base de données | MongoDB Atlas |
| Frontend   | React.js |
| PDF        | PDFKit |
| Auth       | JWT |
| Déploiement backend | Railway.app |
| Déploiement frontend | Vercel |

---

## 📞 Support

Pour toute question sur les APIs :
- MVola : developer@mvola.mg
- Orange Money : https://developer.orange.com/support
- Airtel Money : https://developers.airtel.africa/support
