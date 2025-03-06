// Sammenlign adgangskoden med bcrypt
console.log("Sammenligner adgangskoder...");
console.log("Indtastet adgangskode:", password);
console.log("Gemt adgangskode hash:", user.password);
const isMatch = await bcrypt.compare(password, user.password);
console.log("Adgangskode match:", isMatch);

if (!isMatch) {
  console.log("Adgangskode matcher ikke for bruger:", email);
  return res.status(401).json({
    success: false,
    message: "Forkert adgangskode",
  });
}
