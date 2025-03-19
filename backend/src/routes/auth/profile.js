const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { protect } = require("../../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Konfigurer multer til filupload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../../uploads/profiles");
    // Opret mappen hvis den ikke findes
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "profile-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(
      new Error(
        "Fejl: Kun billeder (jpeg, jpg, png, gif) er tilladt til upload!"
      )
    );
  },
});

// Hent brugerens profil
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Bruger ikke fundet",
      });
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
  } catch (error) {
    console.error("Fejl ved hentning af profil:", error);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved hentning af profil",
    });
  }
});

// Opdater brugerens profil
router.put("/", protect, async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validér input
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Navn og email er påkrævet",
      });
    }

    // Tjek om email allerede er taget af en anden bruger
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser._id.toString() !== req.user.id) {
      return res.status(400).json({
        success: false,
        message: "Email er allerede taget af en anden bruger",
      });
    }

    // Opdater bruger
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Bruger ikke fundet",
      });
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
    });
  } catch (error) {
    console.error("Fejl ved opdatering af profil:", error);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved opdatering af profil",
    });
  }
});

// Upload profilbillede
router.post("/upload", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Ingen fil uploadet",
      });
    }

    // Generer URL til billedet
    const baseUrl =
      process.env.BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
    const imageUrl = `${baseUrl}/uploads/profiles/${req.file.filename}`;

    // Opdater brugerens profilbillede
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: imageUrl },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Bruger ikke fundet",
      });
    }

    res.status(200).json({
      success: true,
      imageUrl,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error("Fejl ved upload af profilbillede:", error);
    res.status(500).json({
      success: false,
      message: "Der opstod en fejl ved upload af profilbillede",
    });
  }
});

module.exports = router;
