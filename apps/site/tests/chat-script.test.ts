import { describe, expect, it } from "vitest";
import { visibleChat, type ChatMessage } from "../src/lib/choreo/chat-script";

const script: ChatMessage[] = [
  { from: "user", text: "a", at: 0.2 },
  { from: "bot", text: "b", at: 0.5 },
  { from: "user", text: "c", at: 0.8 },
];

describe("visibleChat (the conversation is a function of the scroll)", () => {
  it("shows nothing at the start and everything at the end", () => {
    expect(visibleChat(script, 0).shown).toEqual([]);
    expect(visibleChat(script, 1).shown).toHaveLength(3);
  });

  it("shows the messages whose time has come, in order", () => {
    expect(visibleChat(script, 0.55).shown.map((m) => m.text)).toEqual(["a", "b"]);
    expect(visibleChat(script, 0.5).shown.map((m) => m.text)).toEqual(["a", "b"]); // chega exatamente em `at`
    expect(visibleChat(script, 0.499).shown.map((m) => m.text)).toEqual(["a"]);
  });

  it("is reversible: scrolling back removes the messages again", () => {
    expect(visibleChat(script, 0.9).shown.length).toBeGreaterThan(0);
    expect(visibleChat(script, 0.1).shown).toEqual([]);
  });

  it("shows the bot typing just before each bot message, with a longer pause than for the user", () => {
    expect(visibleChat(script, 0.46).typing).toBe("bot"); // janela de 0,06 antes de 0,5
    expect(visibleChat(script, 0.43).typing).toBeNull();
    expect(visibleChat(script, 0.18).typing).toBe("user"); // janela de 0,03 antes de 0,2
    expect(visibleChat(script, 0.5).typing).toBeNull(); // a mensagem chegou
    expect(visibleChat(script, 0.35).typing).toBeNull();
  });
});
