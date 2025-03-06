const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB forbindelse
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Forbundet til MongoDB"))
  .catch((err) => console.error("MongoDB forbindelsesfejl:", err));

// Routes
app.use("/api/users", require("./routes/users"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server kører på port ${PORT}`);
});
