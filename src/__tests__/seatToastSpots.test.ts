import { seatToastSpots } from '@/games/boxhockey/utils/seatToastSpots'

// Where each 2 Player seat's unlock toasts go: the half of the screen that's theirs, turned the way they read it.
describe('seatToastSpots', () => {
  it('puts each player at their own end face to face, player 2 turned across the table', () => {
    expect(seatToastSpots('faceToFace', false, false)).toEqual({ 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } })
  })

  it('keeps the face-to-face halves for a wide window on a device, player 2 turned across the table', () => {
    // A landscape iPad: the board and its touch zones are still face to face.
    expect(seatToastSpots('sideBySide', false, false)).toEqual({ 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } })
  })

  it('splits a computer screen left and right, both upright', () => {
    const sideBySide = { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } }
    expect(seatToastSpots('faceToFace', true, true)).toEqual(sideBySide)
    // A browser window wider than tall, short of the desktop width.
    expect(seatToastSpots('sideBySide', false, true)).toEqual(sideBySide)
  })
})
