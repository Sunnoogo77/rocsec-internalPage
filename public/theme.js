try {
  const preference = localStorage.getItem("rst-theme") || "light";
  document.documentElement.dataset.theme =
    preference === "dark" ||
    (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
      ? "dark"
      : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
