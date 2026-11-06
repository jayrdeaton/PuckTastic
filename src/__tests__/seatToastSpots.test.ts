import { seatToastSpots } from '@/games/boxhockey/utils/seatToastSpots'

// Where each 2 Player seat's unlock toasts go: the half of the screen that's theirs, turned the way they read it.
describe('seatToastSpots', () => {
  it('puts each player at their own end face to face, player 2 turned across the table', () => {
    expect(seatToastSpots({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false }, false)).toEqual({ 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } })
  })

  it('follows the board over when the phone is held upside down', () => {
    expect(seatToastSpots({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: true }, false)).toEqual({ 1: { rotation: 180, zone: 'top' }, 2: { rotation: 0, zone: 'bottom' } })
  })

  it('keeps the face-to-face halves for a wide window on native, player 2 turned across the table', () => {
    // Since @tastic/core 0.15 the reading is the window's shape, never a sideways hold.
    const faceToFace = { 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } }
    expect(seatToastSpots({ orientationMode: 'sideBySide', p1OnRight: true, upsideDown: false }, false, false)).toEqual(faceToFace)
    expect(seatToastSpots({ orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false }, false, false)).toEqual(faceToFace)
  })

  it('splits a computer screen left and right, both upright', () => {
    const sideBySide = { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } }
    expect(seatToastSpots({ orientationMode: 'faceToFace', p1OnRight: false, upsideDown: false }, true, true)).toEqual(sideBySide)
    // A browser window wider than tall, short of the desktop width.
    expect(seatToastSpots({ orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false }, false, true)).toEqual(sideBySide)
  })
})
