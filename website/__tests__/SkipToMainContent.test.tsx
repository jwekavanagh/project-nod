/** @vitest-environment jsdom */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkipToMainContent } from "@/components/SkipToMainContent";

afterEach(() => {
  cleanup();
});

describe("SkipToMainContent", () => {
  it("moves focus to #site-main on click", () => {
    render(
      <>
        <SkipToMainContent />
        <div id="site-main" tabIndex={-1}>
          Main
        </div>
      </>,
    );
    const skip = document.querySelector(".skip-to-main");
    expect(skip).toBeTruthy();
    fireEvent.click(skip!);
    const main = document.getElementById("site-main");
    expect(document.activeElement).toBe(main);
  });
});
