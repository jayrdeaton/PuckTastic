import Svg, { Circle, G, Path } from 'react-native-svg'

import type { GameIconProps } from '@/shell/types'

// One stick: a rounded bar, laid at an angle by its group's transform.
const STICK = 'M848.467,403.813C890.155,403.813 924,435.725 924,475.032C924,514.338 890.155,546.25 848.467,546.25L175.533,546.25C133.845,546.25 100,514.338 100,475.032C100,435.725 133.845,403.813 175.533,403.813L848.467,403.813Z'
// The puck's white ring, around its black face.
const RING = 'M527.349,263.204C595.897,263.204 651.549,318.856 651.549,387.404C651.549,455.951 595.897,511.604 527.349,511.604C458.801,511.604 403.149,455.951 403.149,387.404C403.149,318.856 458.801,263.204 527.349,263.204ZM527.349,279.439C467.762,279.439 419.385,327.816 419.385,387.404C419.385,446.991 467.762,495.368 527.349,495.368C586.937,495.368 635.314,446.991 635.314,387.404C635.314,327.816 586.937,279.439 527.349,279.439Z'

// Box Hockey's icon: two crossed sticks in the seats' colors (seat 2's on top) under the puck.
// Drawn from art/icon.svg (Affinity's export); re-export there and copy the paths over when the
// art changes.
export function GameIcon({ size, p1Color, p2Color }: GameIconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 1024 1024'>
      <G transform='matrix(1,0,0,1,0,64.455843)'>
        <G transform='matrix(0.973187,-0.495863,0.525904,1.032145,-236.092771,365.222912)'>
          <Path d={STICK} fill={p1Color} />
        </G>
        <G transform='matrix(0.973187,0.495863,-0.525904,1.032145,263.549551,-142.54122)'>
          <Path d={STICK} fill={p2Color} />
        </G>
        <G transform='matrix(2.05314,0,0,2.05314,-570.722032,-502.896571)'>
          <Circle cx={527.349} cy={387.404} r={124.2} fill='#0F0F0F' />
          <Path d={RING} fill='#F0F0F0' fillRule='evenodd' />
        </G>
      </G>
    </Svg>
  )
}
