class DarkmodeElement extends HTMLElement {
  mode = "light";
  light = "☀";
  dark = "🌙";
  connectedCallback() {
    this.initMode();
    this.innerText = this.setContent(this.mode);
    this.classList.add("cursor-pointer");
    this.classList.add("select-none");
    this.addEventListener("click", () => {
      this.toggleMode();
    });
  }

  toggleMode() {
    this.mode = this.mode === "light" ? "dark" : "light";
    this.innerText = this.setContent(this.mode);
    this.cache();
    document.documentElement.classList.toggle("dark");
  }

  setContent(mode) {
    return mode === "light" ? this.light : this.dark;
  }

  cache() {
    try {
      localStorage.setItem("dark-mode", this.mode);
    } catch (error) {
      //
    }
  }

  initMode() {
    const mode = localStorage.getItem("dark-mode");
    if (mode) {
      this.mode = mode;
    }
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    }
  }
}

if (!window.customElements.get("dark-mode")) {
  window.DarkmodeElement = DarkmodeElement;
  window.customElements.define("dark-mode", DarkmodeElement);
}
