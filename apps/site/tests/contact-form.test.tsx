// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "../src/components/ContactForm";

afterEach(cleanup);

const fill = (name = "Maria Souza", email = "maria@exemplo.com") => {
  fireEvent.change(screen.getByLabelText(/^nome/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: email } });
};
const send = () => fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
const ok = (status = 201) => vi.fn(async () => new Response("{}", { status })) as unknown as typeof fetch;

describe("ContactForm", () => {
  it("sends the lead and confirms", async () => {
    const fetchImpl = ok();
    render(<ContactForm endpoint="/api/lead" fetchImpl={fetchImpl} />);
    fill();
    send();
    expect(await screen.findByText(/recebemos sua mensagem/i)).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("a double click sends ONE request (the button is disabled while sending)", async () => {
    let release!: () => void;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => (release = () => resolve(new Response("{}", { status: 201 }))))) as unknown as typeof fetch;
    render(<ContactForm endpoint="/api/lead" fetchImpl={fetchImpl} />);
    fill();
    const button = screen.getByRole("button", { name: /enviar/i });
    fireEvent.click(button);
    fireEvent.click(button); // o botão virou "Enviando…" e ficou desabilitado: o segundo clique não pode enviar
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: /enviando/i }) as HTMLButtonElement).disabled).toBe(true);
    release();
    await screen.findByText(/recebemos sua mensagem/i);
  });

  it("explains an invalid e-mail or empty name without sending anything", async () => {
    const fetchImpl = ok();
    render(<ContactForm endpoint="/api/lead" fetchImpl={fetchImpl} />);
    fill("Maria", "isso-nao-e-email");
    send();
    expect(await screen.findByText(/confira o e-mail/i)).toBeTruthy();
    fill("   ", "maria@exemplo.com");
    send();
    expect(await screen.findByText(/diga seu nome/i)).toBeTruthy();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("on failure shows a clear message and the WhatsApp alternative when configured", async () => {
    render(<ContactForm endpoint="/api/lead" fetchImpl={ok(500)} whatsappUrl="https://wa.me/5500000000000" />);
    fill();
    send();
    expect(await screen.findByText(/não foi possível enviar/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /whatsapp/i }) as HTMLAnchorElement;
    expect(link.href).toBe("https://wa.me/5500000000000");
    // o formulário continua preenchido e pode ser reenviado
    expect((screen.getByLabelText(/e-mail/i) as HTMLInputElement).value).toBe("maria@exemplo.com");
    await waitFor(() => expect((screen.getByRole("button", { name: /enviar/i }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("omits the WhatsApp link when it is not configured, and asks to wait after too many attempts", async () => {
    render(<ContactForm endpoint="/api/lead" fetchImpl={ok(429)} />);
    fill();
    send();
    expect(await screen.findByText(/muitas tentativas/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /whatsapp/i })).toBeNull();
  });

  it("has a honeypot field that people cannot reach: out of the tab order and hidden from assistive tech", () => {
    const { container } = render(<ContactForm endpoint="/api/lead" fetchImpl={ok()} />);
    const trap = container.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(trap.autocomplete).toBe("off");
  });
});
