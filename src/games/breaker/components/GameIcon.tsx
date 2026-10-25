import Svg, { Circle, G, Path, Rect } from 'react-native-svg'

import type { GameIconProps } from '@/shell/types'

// The paddle: a rounded bar.
const PADDLE = 'M848.467,403.813C890.155,403.813 924,435.725 924,475.032C924,514.338 890.155,546.25 848.467,546.25L175.533,546.25C133.845,546.25 100,514.338 100,475.032C100,435.725 133.845,403.813 175.533,403.813L848.467,403.813Z'
// The puck's white ring, around its black face.
const RING = 'M527.349,263.204C595.897,263.204 651.549,318.856 651.549,387.404C651.549,455.951 595.897,511.604 527.349,511.604C458.801,511.604 403.149,455.951 403.149,387.404C403.149,318.856 458.801,263.204 527.349,263.204ZM527.349,284.511C470.561,284.511 424.457,330.616 424.457,387.404C424.457,444.192 470.561,490.296 527.349,490.296C584.137,490.296 630.242,444.192 630.242,387.404C630.242,330.616 584.137,284.511 527.349,284.511Z'
// Two rows of four bricks, each its own block with the background showing between them.
const BRICK_XS = [109.214, 313.732, 518.25, 722.768]
const BRICK_YS = [105.541, 168.403]
const BRICK_WIDTH = 192.018
const BRICK_HEIGHT = 50.362

// Breaker's icon: a wall of bricks at the top, the puck, and seat 1's paddle at the bottom (the
// classic brick breaker, the round alone). The bricks take the board's wall color, black on light
// and white on dark, as they do in a match. Drawn from art/icon.svg (Affinity's export, where the
// paddle is blue and the bricks #F0F0F0); re-export there and copy the paths over when the art
// changes.
export function GameIcon({ size, p1Color, dark }: GameIconProps) {
  const brickColor = dark ? '#FFFFFF' : '#000000'
  return (
    <Svg width={size} height={size} viewBox='0 0 1024 1024'>
      <G transform='matrix(0.761963,0,0,0.761963,121.874948,170.987914)'>
        <G transform='matrix(1.092233,0,0,1.158404,-47.223301,356.405014)'>
          <Path d={PADDLE} fill={p1Color} />
        </G>
        <G transform='matrix(2.05314,0,0,2.05314,-570.722032,-347.849745)'>
          <Circle cx={527.349} cy={387.404} r={124.2} fill='#0F0F0F' />
          <Path d={RING} fill='#F0F0F0' fillRule='evenodd' />
        </G>
        <G transform='matrix(1.3124,0,0,1.3124,-159.948644,-224.404487)'>{BRICK_YS.flatMap((y) => BRICK_XS.map((x) => <Rect key={`${x}-${y}`} x={x} y={y} width={BRICK_WIDTH} height={BRICK_HEIGHT} fill={brickColor} />))}</G>
      </G>
    </Svg>
  )
}
