const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const authRoutes = require("./routes/auth");
const { testEmailConnection } = require("./utils/mailer");

// Load env vars
dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3003";

// Definér tilladte origins - tilføj flere lokale porte
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:3003",
  FRONTEND_URL,
];

// Opret Express app
const app = express();
const server = http.createServer(app);

// Konfigurer Socket.IO med forbedret CORS-opsætning
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Tillad anmodninger uden origin (f.eks. fra Postman eller direkte browser-anmodninger)
      if (!origin) return callback(null, true);

      // Tjek om origin er tilladt
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Blokeret CORS for origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  // Tilføj ping timeout og interval for at holde forbindelsen i live
  pingTimeout: 60000,
  pingInterval: 25000,
  // Aktiver automatisk genopkobling
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Socket.IO forbindelser
io.on("connection", (socket) => {
  console.log("En bruger har forbundet sig:", socket.id);

  // Håndter auth token
  const token = socket.handshake.auth.token;
  if (token) {
    console.log("Bruger forbundet med token");
    // Her kunne du validere token og gemme bruger-id på socket-objektet
    // socket.userId = decodedToken.userId;
  }

  // Håndter tilmelding til studiegrupper
  socket.on("join_group", (data) => {
    socket.join(`group-${data.groupId}`);
    console.log(
      `Bruger ${data.userName} (${socket.id}) tilsluttede sig gruppe ${data.groupId}`
    );

    // Informer andre i gruppen om den nye bruger
    socket.to(`group-${data.groupId}`).emit("user_joined", {
      userId: data.userId,
      userName: data.userName,
    });
  });

  // Håndter når en bruger forlader en gruppe
  socket.on("leave_group", (data) => {
    socket.leave(`group-${data.groupId}`);
    console.log(`Bruger ${data.userId} forlod gruppe ${data.groupId}`);

    // Informer andre i gruppen
    socket.to(`group-${data.groupId}`).emit("user_left", {
      userId: data.userId,
    });
  });

  // Håndter chat beskeder
  socket.on("send_message", (data) => {
    console.log(`Besked modtaget i gruppe ${data.groupId}: ${data.text}`);

    // Send beskeden til alle i gruppen (inkl. afsenderen)
    io.to(`group-${data.groupId}`).emit("receive_message", {
      sender: data.sender,
      text: data.text,
      timestamp: data.timestamp,
    });
  });

  // Håndter opdatering af opgavesvar
  socket.on("update_answer", (data) => {
    console.log(
      `Svar opdateret i gruppe ${data.groupId} for opgave ${data.taskId}`
    );

    // Send opdateringen til alle andre i gruppen
    socket.to(`group-${data.groupId}`).emit("answer_updated", data);
  });

  // Håndter "bruger skriver" status
  socket.on("user_typing", (data) => {
    // Send status til alle andre i gruppen
    socket.to(`group-${data.groupId}`).emit("user_typing", {
      userId: data.userId,
      userName: data.userName,
      isTyping: data.isTyping,
    });
  });

  // Ping-pong for at holde forbindelsen i live
  socket.on("ping", (callback) => {
    if (typeof callback === "function") {
      callback();
    }
  });

  // Håndter frakobling
  socket.on("disconnect", (reason) => {
    console.log(`En bruger har afbrudt forbindelsen (${reason}):`, socket.id);
  });
});

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Brug samme CORS-opsætning som Socket.IO
app.use(
  cors({
    origin: function (origin, callback) {
      // Tillad anmodninger uden origin (f.eks. fra Postman eller direkte browser-anmodninger)
      if (!origin) return callback(null, true);

      // Tjek om origin er tilladt
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Blokeret CORS for origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600,
  })
);

// Statiske filer
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);

// Connect til MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Test email-forbindelsen
testEmailConnection()
  .then((success) => {
    if (success) {
      console.log("Email-forbindelse oprettet succesfuldt");
    } else {
      console.warn(
        "Email-forbindelse kunne ikke oprettes - email-funktioner vil muligvis ikke virke"
      );
    }
  })
  .catch((err) => {
    console.error("Fejl ved test af email-forbindelse:", err);
    console.warn("Email-funktioner vil muligvis ikke virke korrekt");
  });

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Der opstod en fejl på serveren",
  });
});

// Tilføj en simpel healthcheck-rute
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Tilføj en test-rute for Socket.IO
app.get("/api/socket-test", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Socket.IO server kører",
    connectedClients: Object.keys(io.sockets.sockets).length,
  });
});

const PORT = process.env.PORT || 5001;

// Start server (server er allerede defineret ovenfor)
server.listen(PORT, () => {
  console.log(`Server kører på port ${PORT}`);
  console.log(`Socket.IO server er klar til forbindelser`);
});

// Graceful shutdown håndtering
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

function gracefulShutdown() {
  console.log("Lukker server ned...");

  // Luk Socket.IO forbindelser
  io.close(() => {
    console.log("Socket.IO forbindelser lukket");

    // Luk HTTP server
    server.close(() => {
      console.log("HTTP server lukket");
      process.exit(0);
    });

    // Hvis serveren ikke lukker inden for 5 sekunder, tving afslutning
    setTimeout(() => {
      console.error("Kunne ikke lukke forbindelser i tide, tvinger afslutning");
      process.exit(1);
    }, 5000);
  });
}
