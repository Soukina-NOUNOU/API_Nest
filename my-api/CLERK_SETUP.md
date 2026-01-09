# Configuration Clerk pour l'authentification - API ONLY

## Variables d'environnement

Ajoutez dans le fichier `.env` :
```env
CLERK_SECRET_KEY=sk_test_clerk_secret_key

# Variables existantes à mettre en place
DATABASE_URL="postgresql://username:password@localhost:5432/mydb?schema=public"
JWT_SECRET="existing-jwt-secret"
PORT=3001
```

## UTILISATION SANS FRONTEND

Maintenant utiliser Clerk uniquement via l'API backend !

### 1. Créer un utilisateur dans Clerk
```bash
POST /auth/clerk/signup
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "monmotdepasse123!",
  "name": "John Doe", // optionnel
}
```

**Réponse :**
```json
{
  "success": true,
  "user": {
    "id": "user_clerk_id",
    "email": "test@example.com",
    "name": "John Doe",
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Utilisateur créé dans Clerk avec succès"
}
```

### 2. Se connecter avec un utilisateur Clerk existant
```bash
POST /auth/clerk/login
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Réponse :**
```json
{
  "success": true,
  "user": {
    "userId": "user_clerk_id",
    "email": "test@example.com",
    "name": "John Doe",
    "clerkId": "user_clerk_id"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Authentification Clerk réussie"
}
```

### 3. Tester l'authentification
```bash
GET /auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```