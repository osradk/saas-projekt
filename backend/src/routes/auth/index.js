const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const crypto = require("crypto");
const { sendEmail } = require("../../utils/mailer");

// Importer auth-ruter
const loginRoutes = require("./login");
const registerRoutes = require("./register");
const profileRoutes = require("./profile");
const passwordRoutes = require("./password");

// Direkte login-rute for kompatibilitet med NextAuth
router.post("/login", async (req, res) => {
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

    // Find bruger
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      console.log("Bruger ikke fundet:", email);
      return res.status(401).json({
        success: false,
        message: "Ugyldig email eller adgangskode",
      });
    }

    // Sammenlign adgangskoder
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Ugyldig email eller adgangskode",
      });
    }

    // Generer token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || "7d",
    });

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

// Direkte "glemt adgangskode"-rute for kompatibilitet med frontend
router.post("/password/forgot", async (req, res) => {
  try {
    console.log("Anmodning om nulstilling af adgangskode for:", req.body.email);
    const { email } = req.body;

    // Validér input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email er påkrævet",
      });
    }

    // Find bruger
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Bruger med denne email findes ikke",
      });
    }

    // Generer reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutter

    await user.save();

    // Opret reset URL
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3003";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
    
    console.log("Nulstillingslink genereret:", resetUrl);

    // Send email
    const message = `
      <h1>Nulstil din adgangskode</h1>
      <p>Du modtager denne email, fordi du (eller en anden) har anmodet om at nulstille din adgangskode.</p>
      <p>Klik på følgende link for at nulstille din adgangskode:</p>
      <a href="${resetUrl}" target="_blank">Nulstil adgangskode</a>
      <p>Hvis du ikke har anmodet om dette, kan du ignorere denne email, og din adgangskode vil forblive uændret.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: "Nulstil din adgangskode",
      html: message,
    });

    res.status(200).json({
      success: true,
      message: "Email sendt med instruktioner til nulstilling af adgangskode",
    });
  } catch (error) {
    console.error("Fejl ved anmodning om nulstilling af adgangskode:", error);

    // Hvis der opstår en fejl, fjern reset token fra bruger
    if (error.user) {
      error.user.resetPasswordToken = undefined;
      error.user.resetPasswordExpire = undefined;
      await error.user.save();
    }

    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved afsendelse af email",
    });
  }
});

// Direkte "nulstil adgangskode"-rute for kompatibilitet med frontend
router.put("/password/reset/:resetToken", async (req, res) => {
  try {
    console.log("Nulstilling af adgangskode med token");
    const { password } = req.body;
    const { resetToken } = req.params;

    // Validér input
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Ny adgangskode er påkrævet",
      });
    }

    // Hash token
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Find bruger med token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Ugyldigt eller udløbet token",
      });
    }

    // Opdater adgangskode
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Adgangskode nulstillet succesfuldt",
    });
  } catch (error) {
    console.error("Fejl ved nulstilling af adgangskode:", error);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved nulstilling af adgangskode",
    });
  }
});

// Brug auth-ruter
router.use("/login", loginRoutes);
router.use("/register", registerRoutes);
router.use("/profile", profileRoutes);
router.use("/password", passwordRoutes);

module.exports = router;
