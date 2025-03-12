const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const { sendEmail } = require("../utils/mailer");
const crypto = require("crypto");

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

    // Opret en ny bruger - lad User modellen håndtere password hashing
    user = new User({
      name,
      email,
      password, // Send raw password - det bliver hashet i User modellen
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
    console.log("Password længde:", password?.length);

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
    console.log("Gemt password hash længde:", user.password?.length);

    // Sammenlign adgangskoden
    console.log("Sammenligner adgangskoder...");
    const isMatch = await user.matchPassword(password);
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
    const { name, email, password, currentPassword } = req.body;
    console.log("Modtaget profilopdatering:", {
      name,
      email,
      userId: req.user.id,
      hasPassword: !!password,
      hasCurrentPassword: !!currentPassword,
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

    // Hent den aktuelle bruger med adgangskode
    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Bruger ikke fundet",
      });
    }

    // Forbered opdateringsdata
    const updateData = { name, email };

    // Hvis der er angivet en ny adgangskode, skal vi validere den nuværende og opdatere
    if (password) {
      // Tjek om nuværende adgangskode er angivet
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Nuværende adgangskode er påkrævet for at ændre adgangskode",
        });
      }

      // Validér nuværende adgangskode
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Nuværende adgangskode er forkert",
        });
      }

      // Krypter og gem den nye adgangskode
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
      console.log("Adgangskode vil blive opdateret");
    }

    // Opdater brugeren
    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Bruger ikke fundet",
      });
    }

    console.log("Bruger opdateret:", updatedUser);

    // Hvis adgangskoden blev ændret, generér en ny token
    let token = null;
    if (password) {
      token = generateToken(updatedUser._id);
      console.log("Ny token genereret efter adgangskodeændring");
    }

    res.status(200).json({
      success: true,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profileImage: updatedUser.profileImage,
      },
      ...(token ? { token } : {}), // Inkluder kun token hvis adgangskoden blev ændret
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

// 🔹 Anmod om nulstilling af adgangskode
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Anmodning om nulstilling af adgangskode for:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email er påkrævet",
      });
    }

    // Find brugeren i databasen
    const user = await User.findOne({ email });

    // Hvis brugeren ikke findes, returnerer vi stadig en succesbesked
    // Dette er for at forhindre enumeration af brugernavne
    if (!user) {
      console.log(
        "Bruger ikke fundet, men returnerer succes for sikkerhed:",
        email
      );
      return res.status(200).json({
        success: true,
        message:
          "Hvis en konto med denne email findes, er der sendt en email med instruktioner til at nulstille adgangskoden.",
      });
    }

    // Generer et reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash token og gem det i databasen
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Sæt udløbstid til 10 minutter
    const resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    // Opdater brugeren med token og udløbstid
    await User.findByIdAndUpdate(user._id, {
      resetPasswordToken,
      resetPasswordExpire,
    });

    // Opret reset URL
    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/reset-password/${resetToken}`;

    // Opret email indhold
    const message = `
      <h1>Nulstilling af adgangskode</h1>
      <p>Du modtager denne email, fordi du (eller en anden) har anmodet om at nulstille adgangskoden til din konto.</p>
      <p>Klik på følgende link for at nulstille din adgangskode:</p>
      <a href="${resetUrl}" target="_blank">Nulstil adgangskode</a>
      <p>Dette link udløber om 10 minutter.</p>
      <p>Hvis du ikke har anmodet om dette, bedes du ignorere denne email, og din adgangskode vil forblive uændret.</p>
    `;

    // Send email
    await sendEmail({
      to: user.email,
      subject: "Nulstilling af adgangskode",
      html: message,
    });

    console.log("Reset email sendt til:", user.email);

    res.status(200).json({
      success: true,
      message: "Email sendt",
    });
  } catch (err) {
    console.error("Fejl ved anmodning om nulstilling af adgangskode:", err);

    // Hvis der opstår en fejl, fjern reset token fra databasen
    if (req.body.email) {
      const user = await User.findOne({ email: req.body.email });
      if (user) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
      }
    }

    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved afsendelse af email",
    });
  }
});

// 🔹 Nulstil adgangskode
router.post("/reset-password/:resetToken", async (req, res) => {
  try {
    const { password } = req.body;
    const { resetToken } = req.params;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Ny adgangskode er påkrævet",
      });
    }

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: "Reset token er påkrævet",
      });
    }

    // Hash token fra URL
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Find bruger med token og tjek om token er udløbet
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Ugyldigt eller udløbet token",
      });
    }

    // Krypter ny adgangskode
    const hashedPassword = await bcrypt.hash(password, 10);

    // Opdater bruger med ny adgangskode og fjern reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    // Generer ny token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Adgangskode nulstillet",
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
    console.error("Fejl ved nulstilling af adgangskode:", err);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved nulstilling af adgangskoden",
    });
  }
});

module.exports = router;
