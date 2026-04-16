export const birr = (value) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
  }).format(value)

export const capitalize = (value = '') =>
  value.charAt(0).toUpperCase() + value.slice(1)
