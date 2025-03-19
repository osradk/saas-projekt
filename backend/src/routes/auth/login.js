const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");

// Generér JWT-token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d", // Standard: 7 dage
  });
};

// Login route
router.post("/", async (req, res) => {
  try {
    console.log("Login forsøg for:", req.body.email);
    const { email, password } = req.body;

    // Validér input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email og adgangskode er påkrævet",
      });
    }

    console.log("Password længde:", password.length);

    // Find bruger
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      console.log("Bruger ikke fundet:", email);
      return res.status(401).json({
        success: false,
        message: "Ugyldig email eller adgangskode",
      });
    }

    console.log("Bruger fundet:", user.name, user.email);
    console.log("Gemt password hash længde:", user.password.length);

    // Sammenlign adgangskoder
    console.log("Sammenligner adgangskoder...");
    const isMatch = await user.matchPassword(password);
    console.log("Adgangskode match:", isMatch);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Ugyldig email eller adgangskode",
      });
    }

    // Generer token
    const token = generateToken(user._id);

    console.log("Login succesfuldt for:", user.email);

    // Send respons
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
  } catch (error) {
    console.error("Login fejl:", error);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved login",
    });
  }
});

module.exports = router;
