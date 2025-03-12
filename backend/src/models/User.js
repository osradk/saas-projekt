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
  resetPasswordToken: String,
  resetPasswordExpire: Date,
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
  console.log("Pre save middleware kørt");
  console.log("Password modificeret:", this.isModified("password"));
  console.log("Password længde:", this.password?.length);

  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log("Password hashet, ny længde:", this.password?.length);
    return next();
  } catch (error) {
    console.error("Fejl ved hashing af password:", error);
    return next(error);
  }
});

// Match password metode
userSchema.methods.matchPassword = async function (enteredPassword) {
  console.log("matchPassword kaldt");
  console.log("Indtastet password længde:", enteredPassword?.length);
  console.log("Gemt password hash længde:", this.password?.length);

  if (!this.password) {
    console.log("Intet gemt password fundet");
    return false;
  }

  try {
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log("Password match resultat:", isMatch);
    return isMatch;
  } catch (error) {
    console.error("Fejl ved sammenligning af passwords:", error);
    return false;
  }
};

module.exports = mongoose.model("User", userSchema);
