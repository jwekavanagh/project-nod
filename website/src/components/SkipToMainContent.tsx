"use client";

function focusMain() {
  const el = document.getElementById("site-main");
  if (!el) return;
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ block: "start" });
  }
  el.focus();
}

export function SkipToMainContent() {
  return (
    <a
      href="#site-main"
      className="skip-to-main"
      onClick={(e) => {
        e.preventDefault();
        focusMain();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        focusMain();
      }}
    >
      Skip to main content
    </a>
  );
}
