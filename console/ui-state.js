(function attachConsoleUiState(root) {
  function setMessage(element, value, error = false) {
    if (!element) return;
    element.textContent = value;
    element.setAttribute("role", error ? "alert" : "status");
    element.setAttribute("aria-live", error ? "assertive" : "polite");
  }

  function beginRequest(container) {
    if (!container || container.getAttribute("aria-busy") === "true") return null;
    const controls = Array.from(container.querySelectorAll("button, input[type=submit]"));
    if (container.matches?.("button, input[type=submit]")) controls.unshift(container);
    const disabled = controls.map((control) => control.disabled);
    container.setAttribute("aria-busy", "true");
    controls.forEach((control) => { control.disabled = true; });
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      container.setAttribute("aria-busy", "false");
      controls.forEach((control, index) => { control.disabled = disabled[index]; });
    };
  }

  root.ConsoleUiState = { beginRequest, setMessage };
})(window);
