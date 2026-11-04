import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiIntro } from "@/components/AiIntro";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AI introduction fallback behavior", () => {
  it("shows the offline verified introduction with retry when the AI service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("AI service down")));
    render(<AiIntro />);
    fireEvent.click(screen.getByRole("button", { name: /meet my ai intro/i }));
    await waitFor(() => {
      expect(screen.getByText(/offline introduction/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry live ai/i })).toBeInTheDocument();
    expect(screen.getByText(/Hyderabad/i)).toBeInTheDocument();
  });

  it("recovers the live AI introduction after a successful retry", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("AI service down"))
      .mockResolvedValueOnce(new Response("Live AI introduction from the gateway."));
    vi.stubGlobal("fetch", fetchMock);
    render(<AiIntro />);
    fireEvent.click(screen.getByRole("button", { name: /meet my ai intro/i }));
    await waitFor(() => {
      expect(screen.getByText(/offline introduction/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /retry live ai/i }));
    await waitFor(() => {
      expect(screen.getByText(/Live AI introduction from the gateway\./i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/offline introduction/i)).not.toBeInTheDocument();
  });
});
