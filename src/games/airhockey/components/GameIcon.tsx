import Svg, { G, Path } from 'react-native-svg'

import type { GameIconProps } from '@/shell/types'

// A mallet's body, and the puck's black face.
const DISC = 'M527.349,263.204C595.892,263.204 651.549,318.861 651.549,387.404C651.549,455.946 595.892,511.604 527.349,511.604C458.807,511.604 403.149,455.946 403.149,387.404C403.149,318.861 458.807,263.204 527.349,263.204Z'
// A mallet's white knob ring.
const KNOB = 'M306,619.993C344.837,619.993 376.379,651.534 376.379,690.372C376.379,729.209 344.838,760.751 306,760.751C267.163,760.751 235.621,729.21 235.621,690.372C235.621,651.535 267.162,619.993 306,619.993ZM306,636.75C276.415,636.75 252.378,660.787 252.378,690.372C252.378,719.957 276.415,743.994 306,743.994C335.585,743.994 359.622,719.957 359.622,690.372C359.622,660.787 335.585,636.75 306,636.75Z'
// The puck's white ring, around its black face.
const RING = 'M527.349,263.204C595.892,263.204 651.549,318.861 651.549,387.404C651.549,455.946 595.892,511.604 527.349,511.604C458.807,511.604 403.149,455.946 403.149,387.404C403.149,318.861 458.807,263.204 527.349,263.204ZM527.349,283.301C469.898,283.301 423.246,329.953 423.246,387.404C423.246,444.854 469.898,491.507 527.349,491.507C584.8,491.507 631.452,444.855 631.452,387.404C631.452,329.953 584.8,283.301 527.349,283.301Z'

// Air Hockey's icon: the two seats' mallets on opposite corners (seat 1's bottom right, seat 2's top
// left) with the puck between them. Drawn from art/icon.svg (Affinity's export); re-export there and
// copy the paths over when the art changes.
export function GameIcon({ size, p1Color, p2Color }: GameIconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 1024 1024'>
      <G transform='matrix(-1,0,0,-1,1024,1051.628156)'>
        <G transform='matrix(1,0,0,1,0,27.628156)'>
          <G transform='matrix(1.658615,0,0,1.658615,-156.669563,75.446494)'>
            <Path d={DISC} fill={p2Color} />
          </G>
          <G transform='matrix(0.994617,0,0,0.994617,413.647074,31.344147)'>
            <Path d={KNOB} fill='#F0F0F0' fillRule='evenodd' />
          </G>
        </G>
        <G transform='matrix(1.658615,0,0,1.658615,-568.669563,-308.92535)'>
          <Path d={DISC} fill={p1Color} />
        </G>
        <G transform='matrix(0.994617,0,0,0.994617,1.268253,-353.406518)'>
          <Path d={KNOB} fill='#F0F0F0' fillRule='evenodd' />
        </G>
        <G transform='matrix(1.658615,0,0,1.658615,-362.669563,-102.92535)'>
          <Path d={DISC} fill='#0F0F0F' />
          <Path d={RING} fill='#F0F0F0' fillRule='evenodd' />
        </G>
      </G>
    </Svg>
  )
}
