// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServicesList } from "@/components/ServicesList";
import { pt } from "@/content/copy/pt";

describe("ServicesList (seção 2)", () => {
  it("lists the five services in order, numbered, under an accessible label", () => {
    render(<ServicesList label={pt.s2.servicesLabel} services={pt.s2.services} />);
    const list = screen.getByRole("list", { name: pt.s2.servicesLabel });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items.map((li) => li.textContent)).toEqual(pt.s2.services.map((s, i) => `0${i + 1}${s.name}`));
  });

  it("is a plain list: no buttons, no cards, nothing to focus", () => {
    const { container } = render(<ServicesList label="x" services={pt.s2.services} />);
    expect(container.querySelectorAll("button, [data-service-card], [tabindex]")).toHaveLength(0);
  });
});
