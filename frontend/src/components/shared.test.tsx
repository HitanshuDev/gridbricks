import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, MetricCard, ProvenanceBadge } from "./shared";

describe("dashboard shared components", () => {
  it("labels synthetic observations clearly", () => {
    render(<ProvenanceBadge provenance="synthetic" label="SYNTHETIC DEMO DATA" />);
    expect(screen.getByText("SYNTHETIC DEMO DATA")).toBeInTheDocument();
  });

  it("shows a meaningful empty state", () => {
    render(<EmptyState message="Select demo data to explore the portal." />);
    expect(screen.getByText("No observations available")).toBeInTheDocument();
    expect(screen.getByText("Select demo data to explore the portal.")).toBeInTheDocument();
  });

  it("renders the metric unit and unavailable value", () => {
    render(<MetricCard label="Mean absolute error" value="N/A" unit="MW" detail="No valid pairs" />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("MW")).toBeInTheDocument();
  });
});
