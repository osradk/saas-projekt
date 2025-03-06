const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Navn er påkrævet"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email er påkrævet"],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Indtast venligst en gyldig email",
    ],
  },
  password: {
    type: String,
    required: [true, "Adgangskode er påkrævet"],
    minlength: 6,
    select: false,
  },
  profileImage: {
    type: String,
    maxLength: [5 * 1024 * 1024, "Profilbillede må ikke være større end 5MB"],
    default: null,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  learningProgress: {
    completedLetters: [
      {
        letter: String,
        completedAt: Date,
        score: Number,
      },
    ],
    totalScore: {
      type: Number,
      default: 0,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password før gem
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password metode
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
