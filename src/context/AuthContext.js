const login = async (email, password) => {
  console.log("Login forsøg i AuthContext");
  try {
    console.log("Sender login-anmodning til API med email:", email);
    const response = await api.auth.login({ email, password });
    console.log("Login response:", response);

    if (!response.user) {
      throw new Error("Brugerdata mangler i response");
    }

    // Gem data i localStorage
    localStorage.setItem("token", response.token);
    localStorage.setItem("user", JSON.stringify(response.user));

    // Opdater state
    setUser(response.user);
    console.log("Bruger sat i state:", response.user);

    return response;
  } catch (err) {
    console.error("Login fejl:", err);
    // Tilføj mere specifik fejlhåndtering baseret på fejltypen
    if (err.message === "Failed to fetch") {
      console.error(
        "Kunne ikke forbinde til backend-serveren. Kontroller, at serveren kører på port 5001."
      );
    }
    throw err;
  }
};
