const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

// 🔹 Generér JWT-token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d", // Standard: 7 dage
  });
};

// 🔹 Registrer en ny bruger
router.post("/register", async (req, res) => {
  try {
    console.log("Register request modtaget:", req.body);
    const { name, email, password, role } = req.body;

    // Validér input
    if (!name || !email || !password) {
      console.log("Manglende påkrævede felter:", {
        name,
        email,
        password: !!password,
      });
      return res.status(400).json({
        success: false,
        message: "Navn, email og adgangskode er påkrævet",
      });
    }

    // Check om email allerede findes
    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ success: false, message: "Email er allerede taget" });
    }

    try {
      // Krypter adgangskoden
      const hashedPassword = await bcrypt.hash(password, 10);

      // Opret en ny bruger
      user = new User({
        name,
        email,
        password: hashedPassword,
        role: role || "user",
      });

      await user.save();
      console.log("Bruger gemt i database:", user._id);

      // Generér token og returnér bruger
      const token = generateToken(user._id);
      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage,
        },
      });
    } catch (hashError) {
      console.error("Fejl ved kryptering eller oprettelse:", hashError);
      return res.status(500).json({
        success: false,
        message: "Fejl ved kryptering eller oprettelse af bruger",
        error: hashError.message,
      });
    }
  } catch (err) {
    console.error("Registreringsfejl:", err);
    res.status(500).json({
      success: false,
      message: "Serverfejl",
      error: err.message,
    });
  }
});

// 🔹 Login bruger
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login forsøg for:", email);

    // Tjek om email og password er angivet
    if (!email || !password) {
      console.log("Manglende email eller adgangskode");
      return res.status(400).json({
        success: false,
        message: "Indtast venligst både email og adgangskode",
      });
    }

    // Find brugeren i databasen
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      console.log("Bruger ikke fundet:", email);
      return res.status(401).json({
        success: false,
        message: "Ugyldige loginoplysninger",
      });
    }

    console.log("Bruger fundet:", user.name, user.email);

    // Sikr at password ikke er null eller undefined
    if (!user.password) {
      console.log("Adgangskode mangler i databasen");
      return res.status(500).json({
        success: false,
        message: "Adgangskoden er ikke gemt korrekt i databasen",
      });
    }

    // Sammenlign adgangskoden med bcrypt
    console.log("Sammenligner adgangskoder...");
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Adgangskode match:", isMatch);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Forkert adgangskode",
      });
    }

    // Generér JWT-token
    const token = generateToken(user._id);
    console.log("Login succesfuldt for:", user.email);

    // Returnér brugerdata uden password
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
      },
    });
  } catch (err) {
    console.error("Login fejl i backend:", err);
    res.status(500).json({ success: false, message: "Serverfejl" });
  }
});

// 🔹 Hent den nuværende bruger (Kun for loggede-in brugere)
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password"); // Hent bruger uden password

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Bruger ikke fundet" });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
      },
    });
  } catch (err) {
    console.error("Fejl i getMe:", err);
    res.status(500).json({ success: false, message: "Serverfejl" });
  }
});

// 🔹 Hent alle brugere (Kun for admin)
router.get("/users", protect, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (err) {
    console.error("Fejl i hentning af brugere:", err);
    res.status(500).json({ success: false, message: "Serverfejl" });
  }
});

// 🔹 Opdater brugerprofil (Kun for loggede-in brugere)
router.post("/update-profile", protect, async (req, res) => {
  try {
    const { name, email } = req.body;
    console.log("Modtaget profilopdatering:", {
      name,
      email,
      userId: req.user.id,
    });

    // Validér input
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Navn og email er påkrævet",
      });
    }

    // Check om email allerede er taget (hvis den er ændret)
    const existingUser = await User.findOne({
      email,
      _id: { $ne: req.user.id },
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email er allerede i brug",
      });
    }

    // Opdater brugeren
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Bruger ikke fundet",
      });
    }

    console.log("Bruger opdateret:", updatedUser);

    res.status(200).json({
      success: true,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profileImage: updatedUser.profileImage,
      },
    });
  } catch (err) {
    console.error("Fejl ved profilopdatering:", err);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved opdatering af profilen",
      error: err.message,
    });
  }
});

// 🔹 Upload profilbillede
router.post("/upload-profile-image", protect, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    console.log("Modtaget profilbillede upload:", {
      userId: req.user.id,
      imageUrl,
    });

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Billede URL er påkrævet",
      });
    }

    // Opdater brugerens profilbillede
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: imageUrl },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Bruger ikke fundet",
      });
    }

    console.log("Profilbillede opdateret:", updatedUser);

    res.status(200).json({
      success: true,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profileImage: updatedUser.profileImage,
      },
    });
  } catch (err) {
    console.error("Fejl ved upload af profilbillede:", err);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved upload af profilbilledet",
      error: err.message,
    });
  }
});

module.exports = router;
