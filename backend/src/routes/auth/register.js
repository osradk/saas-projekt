const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// Generér JWT-token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d", // Standard: 7 dage
  });
};

// Register route
router.post("/", async (req, res) => {
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

    // Opret en ny bruger - lad User modellen håndtere password hashing
    user = new User({
      name,
      email,
      password, // Send raw password - det bliver hashet i User modellen
      role: role || "user",
    });

    // Gem brugeren i databasen
    await user.save();
    console.log("Bruger gemt i database:", user._id);

    // Generer token
    const token = generateToken(user._id);

    // Send respons
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
  } catch (error) {
    console.error("Register fejl:", error);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved registrering",
    });
  }
});

module.exports = router;
