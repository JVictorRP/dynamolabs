// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "../src/components/ContactForm";

afterEach(cleanup);

describe("ContactForm honeypot (item: the field was never read, so a bot's value was thrown away on the client)", () => {
  it("sends whatever ended up in the honeypot field, so the server can drop the lead", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const { container } = render(<ContactForm endpoint="/api/lead" fetchImpl={fetchImpl} />);
    fireEvent.change(screen.getByLabelText(/^nome/i), { target: { value: "Robô" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "robo@spam.example" } });
    fireEvent.change(container.querySelector('input[name="website"]')!, { target: { value: "http://spam.example" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    await screen.findByText(/recebemos sua mensagem/i);
    expect(JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body).website).toBe("http://spam.example");
  });

  it("still sends an empty honeypot for people", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 201 })) as unknown as typeof fetch;
    render(<ContactForm endpoint="/api/lead" fetchImpl={fetchImpl} />);
    fireEvent.change(screen.getByLabelText(/^nome/i), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "maria@exemplo.com" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    await screen.findByText(/recebemos sua mensagem/i);
    expect(JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body).website).toBe("");
  });
});
