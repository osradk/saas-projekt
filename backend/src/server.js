const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");
const { testEmailConnection } = require("./utils/mailer");

// Load env vars
dotenv.config();

// Opret Express app
const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = ["http://localhost:3000", "http://localhost:3001"];
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
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

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server kører på port ${PORT}`);
});
