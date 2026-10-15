// the household, shared by the Couch App and the 449 Exchange so a roommate is
// the same colour everywhere
export const ROOMMATES = [
  { name: 'Noah', color: '#0A84FF', ink: '#fff' },
  { name: 'Bryon', color: '#30D158', ink: '#0B3D1C' },
  { name: 'Jonas', color: '#FF9F0A', ink: '#4A2A00' },
  { name: 'Andrew', color: '#BF5AF2', ink: '#fff' },
  { name: 'James', color: '#FF375F', ink: '#fff' }
]
export const NAMES = ROOMMATES.map((r) => r.name)
export const COLOR = Object.fromEntries(ROOMMATES.map((r) => [r.name, r.color]))
export const INK = Object.fromEntries(ROOMMATES.map((r) => [r.name, r.ink]))
