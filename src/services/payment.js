const TELEBIRR_CONFIGURED = false

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function mockPay(orderDraft) {
  await delay(1100)
  return {
    provider: 'telebirr-mock',
    paymentReference: `TB-MOCK-${Date.now()}`,
    paid: true,
    amount: orderDraft.total,
  }
}

export async function initiateTelebirrPayment(orderDraft) {
  if (TELEBIRR_CONFIGURED) {
    throw new Error('Telebirr live integration not wired yet.')
  }
  return mockPay(orderDraft)
}

export function getPaymentIntegrationStatus() {
  return {
    provider: 'Telebirr',
    isLive: TELEBIRR_CONFIGURED,
    message: TELEBIRR_CONFIGURED
      ? 'Live merchant credentials configured.'
      : 'Using mock Telebirr adapter until merchant credentials are provided.',
  }
}
