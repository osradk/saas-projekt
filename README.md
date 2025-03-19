# LæreLeg Platform

En interaktiv læringsplatform, der kombinerer leg og læring for at skabe en engagerende uddannelsesoplevelse.

## Projektstruktur

Projektet er organiseret som et monorepo med separate mapper for frontend og backend:

### Backend (Express + MongoDB + Socket.IO)

```
backend/
├── src/
│   ├── routes/          # API-ruter
│   │   ├── auth/        # Auth-relaterede ruter
│   │   │   ├── index.js
│   │   │   ├── login.js
│   │   │   ├── register.js
│   │   │   ├── profile.js
│   │   │   └── password.js
│   ├── models/          # MongoDB-modeller
│   ├── middleware/      # Middleware-funktioner
│   ├── utils/           # Hjælpefunktioner
│   └── server.js        # Hovedapplikation
├── uploads/             # Uploadede filer
└── .env                 # Miljøvariabler
```

### Frontend (Next.js + React)

```
frontend/
├── src/
│   ├── app/             # Next.js app router
│   │   ├── api/         # API-ruter (kun [...nextauth])
│   │   ├── dashboard/   # Dashboard-side
│   │   ├── login/       # Login-side
│   │   └── ...          # Andre sider
│   ├── components/      # Genbrugelige komponenter
│   ├── context/         # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── services/        # Service-lag
│   └── utils/           # Hjælpefunktioner
├── public/              # Statiske filer
└── .env.local           # Miljøvariabler
```

## Teknologier

### Backend

- Node.js
- Express
- MongoDB (med Mongoose)
- Socket.IO for realtidskommunikation
- JWT til autentificering
- Multer til filupload

### Frontend

- Next.js 15
- React
- NextAuth.js til autentificering
- Tailwind CSS til styling
- Socket.IO-client til realtidskommunikation

## Opsætning

### Forudsætninger

- Node.js (v18+)
- MongoDB (lokalt eller Atlas)
- npm eller yarn

### Backend

1. Naviger til backend-mappen:

   ```
   cd backend
   ```

2. Installer afhængigheder:

   ```
   npm install
   ```

3. Opret en `.env`-fil med følgende variabler:

   ```
   PORT=5001
   MONGODB_URI=mongodb://localhost:27017/laereleg
   JWT_SECRET=din_hemmelige_noegle
   JWT_EXPIRE=7d
   EMAIL_HOST=smtp.example.com
   EMAIL_PORT=587
   EMAIL_USER=din_email@example.com
   EMAIL_PASS=din_adgangskode
   FRONTEND_URL=http://localhost:3000
   ```

4. Start serveren:
   ```
   npm run dev
   ```

### Frontend

1. Naviger til frontend-mappen:

   ```
   cd frontend
   ```

2. Installer afhængigheder:

   ```
   npm install
   ```

3. Opret en `.env.local`-fil med følgende variabler:

   ```
   NEXT_PUBLIC_API_URL=http://localhost:5001
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=din_hemmelige_noegle
   ```

4. Start udviklingsserveren:
   ```
   npm run dev
   ```

## API-dokumentation

### Auth API

- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registrer ny bruger
- `GET /api/auth/profile` - Hent brugerens profil
- `PUT /api/auth/profile` - Opdater brugerens profil
- `POST /api/auth/profile/upload` - Upload profilbillede
- `PUT /api/auth/password/change` - Ændr adgangskode
- `POST /api/auth/password/forgot` - Anmod om nulstilling af adgangskode
- `PUT /api/auth/password/reset/:resetToken` - Nulstil adgangskode

## Socket.IO Events

Se `frontend/src/README-socket.md` for detaljeret dokumentation om Socket.IO-integrationen.

## Licens

Dette projekt er licenseret under MIT-licensen.
