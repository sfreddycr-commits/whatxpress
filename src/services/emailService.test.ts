import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-123" });
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
      verify: vi.fn().mockResolvedValue(true),
    })),
  },
}));

import { sendWelcomeEmail, sendReceiptEmail, sendTrialEndingEmail, sendRenewedEmail, sendPaymentFailedEmail } from "./emailService";

describe("emailService", () => {
  beforeEach(() => {
    mockSendMail.mockClear();
    process.env.SMTP_PASS = "test_pass";
  });

  it("sendWelcomeEmail sends with correct data", async () => {
    const result = await sendWelcomeEmail("test@test.com", "Test Restaurant", "Pro");
    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe("test@test.com");
    expect(call.subject).toContain("Test Restaurant");
    expect(call.html).toContain("Pro");
  });

  it("sendReceiptEmail includes transaction data", async () => {
    const result = await sendReceiptEmail("test@test.com", "Test", 99, "USD", "Pro", "TX-12345");
    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain("Recibo");
    expect(call.html).toContain("99");
    expect(call.html).toContain("TX-12345");
  });

  it("sendTrialEndingEmail shows correct days", async () => {
    const result = await sendTrialEndingEmail("test@test.com", "Test", 2);
    expect(result).toBe(true);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain("2");
  });

  it("sendRenewedEmail includes next date", async () => {
    const result = await sendRenewedEmail("test@test.com", "Test", "Pro", "17 May 2026");
    expect(result).toBe(true);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain("17 May 2026");
  });

  it("sendPaymentFailedEmail shows amount", async () => {
    const result = await sendPaymentFailedEmail("test@test.com", "Test", 99, "USD");
    expect(result).toBe(true);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain("99");
  });

  it("handles SMTP failure gracefully", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));
    const result = await sendWelcomeEmail("test@test.com", "Test", "Pro");
    expect(result).toBe(false);
  });
});
