const nodemailer = require("nodemailer");

// Opret en SMTP transporter med Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true for 465, false for andre porte
  auth: {
    user: "osradk@gmail.com",
    pass: "nqci lwaf mkjv ljnb", // App password
  },
  // Tilføj timeout for at undgå at hænge
  connectionTimeout: 10000, // 10 sekunder
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

/**
 * Send en email
 * @param {Object} options - Email options
 * @param {string} options.to - Modtager email
 * @param {string} options.subject - Email emne
 * @param {string} options.text - Tekst version af email
 * @param {string} options.html - HTML version af email
 * @returns {Promise} - Resultat af email afsendelse
 */
const sendEmail = async (options) => {
  const mailOptions = {
    from: '"OSRA" <osradk@gmail.com>',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html || options.text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sendt: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Fejl ved afsendelse af email:", error);
    // Kast fejlen videre, men med en mere specifik besked
    throw new Error(`Kunne ikke sende email: ${error.message}`);
  }
};

// Test email-forbindelsen ved opstart
const testEmailConnection = async () => {
  try {
    const result = await transporter.verify();
    console.log("SMTP-server er klar til at sende emails");
    return true;
  } catch (error) {
    console.error("SMTP-forbindelsesfejl:", error);
    // Returner false i stedet for at kaste en fejl
    return false;
  }
};

module.exports = {
  sendEmail,
  testEmailConnection,
};
