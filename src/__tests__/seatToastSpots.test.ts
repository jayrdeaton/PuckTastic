import { seatToastSpots } from '@/games/boxhockey/utils/seatToastSpots'

// Where each 2 Player seat's unlock toasts go: the half of the screen that's theirs, turned the way they read it. Face to face only on a
// phone or tablet (natively or in its browser); at a computer side by side, whatever the window's shape (the shell's useAtComputer).
describe('seatToastSpots', () => {
  it('puts each player at their own end on a phone or tablet, player 2 turned across the table, in any window', () => {
    expect(seatToastSpots(false)).toEqual({ 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } })
  })

  it('splits a computer screen left and right, both upright', () => {
    expect(seatToastSpots(true)).toEqual({ 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } })
  })
})
