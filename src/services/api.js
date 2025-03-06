login: async (credentials) => {
  console.log("Login request:", credentials);
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });
    const data = await handleResponse(response);
    console.log("Login response:", data);

    if (data.user) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user)); // Gem brugerdata
    }
    return data;
  } catch (error) {
    console.error("API login fejl:", error.message);
    throw error;
  }
}, 