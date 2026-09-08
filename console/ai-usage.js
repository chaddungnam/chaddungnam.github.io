(function (root) {
  const frame = () => document.getElementById("aiUsageFrame");
  function mount() {
    if (!root.ConsoleAuth.isUnlocked()) return;
    if (!frame().getAttribute("src")) frame().src = "ai-usage.html?v=20260908-2";
    else frame().contentWindow?.fetchData?.();
  }
  function clear() { frame()?.removeAttribute("src"); }
  root.ConsoleAiUsage = { mount, clear };
})(window);
