const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { protect } = require("../../middleware/auth");
const crypto = require("crypto");
const { sendEmail } = require("../../utils/mailer");

// Ændr adgangskode (når bruger er logget ind)
router.put("/change", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validér input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Nuværende og ny adgangskode er påkrævet",
      });
    }

    // Find bruger
    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Bruger ikke fundet",
      });
    }

    // Tjek om nuværende adgangskode er korrekt
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Nuværende adgangskode er forkert",
      });
    }

    // Opdater adgangskode
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Adgangskode ændret succesfuldt",
    });
  } catch (error) {
    console.error("Fejl ved ændring af adgangskode:", error);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved ændring af adgangskode",
    });
  }
});

// Anmod om nulstilling af adgangskode
router.post("/forgot", async (req, res) => {
  try {
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
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

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
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
    }

    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved afsendelse af email",
    });
  }
});

// Nulstil adgangskode
router.put("/reset/:resetToken", async (req, res) => {
  try {
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

module.exports = router;
